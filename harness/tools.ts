import { tool } from 'ai';
import { z } from 'zod';
import { KNOWLEDGE_BASE } from './knowledge-base';
import type { SandboxApi } from './types';
import { CHARGES } from './mocks';
import { runInSandbox } from './sandbox';
import { AGENT_NAMES } from '@shared/agent-names';

export const searchKB = (query: string) => {
  const hits = Object.entries(KNOWLEDGE_BASE)
    .filter(([key]) => query.toLocaleLowerCase().includes(key))
    .map(([, article]) => article);

  return { articles: hits.length ? hits : ['No relevant articles found.'] };
};

const sandboxApi: SandboxApi = {
  getCharges: (customerId: string) => CHARGES[customerId] ?? [],
  searchKnowledgeBase: async (query: string) => searchKB(query),
};

export const handoffInputSchema = z.object({ to: z.enum(AGENT_NAMES), reason: z.string() });

export const tools = {
  searchKnowledgeBase: tool({
    description: 'Search the support knowledge base for relevant articles.',
    inputSchema: z.object({
      query: z.string().describe('what to look up'),
    }),
  }),

  classifyItem: tool({
    description: 'Classify a work item into a category.',
    inputSchema: z.object({
      itemId: z.string(),
      category: z.enum(['billing', 'technical', 'sales', 'other']),
    }),
  }),

  draftReply: tool({
    description: 'Write a draft reply for a work item. Does not send anything.',
    inputSchema: z.object({
      itemId: z.string(),
      message: z.string(),
    }),
  }),

  sendReply: tool({
    description: 'Send the drafted reply to the customer. This really emails them.',
    inputSchema: z.object({
      itemId: z.string(),
      draftId: z.string(),
    }),
  }),

  runCode: tool({
    description: [
      'Run a JavaScript program (an async function body) to fetch and analyze data.',
      'Available inside the program:',
      '  • await tools.getCharges(customerId) → [{ id, amount (cents), date, description }]',
      '  • await tools.searchKnowledgeBase(query) → string[]',
      '  • console.log(...) for debugging',
      'Use `return` to return your result (any JSON value).',
    ].join('\n'),
    inputSchema: z.object({ code: z.string() }),
  }),

  issueRefund: tool({
    description: 'Issue a refund to the customer. IRREVERSIBLE — this moves real money.',
    inputSchema: z.object({
      customerId: z.string(),
      chargeId: z.string(),
      amountCents: z.number(),
    }),
  }),

  handoff: tool({
    description:
      "Hand off the conversation to a specialist agent when the task needs a capability you don't have (e.g. issuing a refund → billing).",
    inputSchema: handoffInputSchema,
  }),
};

export async function runTool(
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'searchKnowledgeBase': {
      return { articles: searchKB(String(args.query)) };
    }
    case 'classifyItem': {
      return { ok: true, itemId: args.itemId, category: args.category };
    }
    case 'draftReply': {
      return { ok: true, draftId: `draft-${args.itemId}` };
    }
    case 'sendReply': {
      return { ok: true, itemId: args.itemId, draftId: args.draftId };
    }
    case 'runCode': {
      return runInSandbox(String(args?.code ?? ''), sandboxApi);
    }
    case 'getCharges': {
      return { charges: CHARGES[String(args.customerId)] ?? [] };
    }
    case 'issueRefund': {
      return {
        ok: true,
        customerId: args.customerId,
        chargeId: args.chargeId,
        amountCents: args.amountCents,
      };
    }
    default: {
      throw new Error(`Unknown tool: ${name}`);
    }
  }
}
