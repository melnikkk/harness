import { z } from 'zod';
import { generateText, stepCountIs, tool } from 'ai';
import { searchKB } from './tools';
import { CHARGES } from './mocks';
import { model } from './model';

const getCharges = tool({
  description: "Look up a customer's charges.",
  inputSchema: z.object({ customerId: z.string() }),
  execute: async ({ customerId }) => CHARGES[customerId] ?? [],
});

const searchKnowledgeBase = tool({
  description: 'Search the support knowledge base.',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => searchKB(query),
});

type Investigator = {
  systemPrompt: string;
  tools: Record<string, typeof getCharges | typeof searchKnowledgeBase>;
};

const INVESTIGATORS: Record<string, Investigator> = {
  billing: {
    systemPrompt:
      "You are a billing investigator. Use getCharges to find duplicate or erroneous charges. Report the charge ids, the amount, and the refund you'd recommend — concisely.",
    tools: { getCharges },
  },
  technical: {
    systemPrompt:
      'You are a technical investigator. Use searchKnowledgeBase to find known bugs and workarounds. Report the issue, any ticket, and the workaround — concisely.',
    tools: { searchKnowledgeBase },
  },
  sales: {
    systemPrompt:
      'You are a sales investigator. Use searchKnowledgeBase for pricing guidance, then state the relevant numbers and next step — concisely.',
    tools: { searchKnowledgeBase },
  },
};

export async function runInvestigator(agentName: string, objective: string): Promise<string> {
  if (process.env.CHAOS_FAIL === agentName) {
    throw new Error(`Chaos fail triggered for agent ${agentName}`);
  }

  const investigator = INVESTIGATORS[agentName];

  if (!investigator) {
    throw new Error(`Unknown investigator: ${agentName}`);
  }

  const { text } = await generateText({
    model,
    system: investigator.systemPrompt,
    prompt: objective,
    tools: investigator.tools,
    stopWhen: stepCountIs(5),
  });

  return text;
}
