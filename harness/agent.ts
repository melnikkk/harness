import type { ToolSet } from 'ai';
import { AGENT_NAMES, type AgentName } from '@shared/agent-names';
import { tools } from './tools';

export type Agent = {
  name: string;
  systemPrompt: string;
  tools: ToolSet;
};

const TRIAGE_AGENT_SYSTEM_PROMPT = `You are a support triage agent.

For each work item:
1. Classify it with classifyItem.
2. If it needs data lookup or math, use runCode (you have tools.getCharges and tools.searchKnowledgeBase inside it).
3. Draft a reply with draftReply, then send it with sendReply.

IMPORTANT: you are NOT allowed to issue refunds. If a customer needs an actual
refund (money moved back), hand off to the billing specialist with
handoff({ to: ${AGENT_NAMES.BILLING}, reason }). Do not draft or send anything yourself in
that case — let billing take over.

Handle the items, then briefly summarize what you did.`;

export const triageAgent: Agent = {
  name: AGENT_NAMES.TRIAGE,
  systemPrompt: TRIAGE_AGENT_SYSTEM_PROMPT,
  tools: {
    classifyItem: tools.classifyItem,
    runCode: tools.runCode,
    sendReply: tools.sendReply,
    handoff: tools.handoff,
  },
};

const BILLING_AGENT_SYSTEM_PROMPT = `You are the billing & refunds specialist. issueRefund is 
IRREVERSIBLE and moves real money, so be careful — but it IS your job.

When a refund is needed, ALWAYS do all of this — never just describe it:
1. Use runCode (tools.getCharges) to verify the duplicate charge and the exact amount.
2. Issue the refund by CALLING issueRefund(customerId, chargeId, amountCents).
3. Draft and send a confirmation with draftReply + sendReply.

Then briefly summarize what you did. Do not stop after only acknowledging — act.`;

export const billingAgent: Agent = {
  name: AGENT_NAMES.BILLING,
  systemPrompt: BILLING_AGENT_SYSTEM_PROMPT,
  tools: {
    runCode: tools.runCode,
    issueRefund: tools.issueRefund,
    draftReply: tools.draftReply,
    sendReply: tools.sendReply,
  },
};

export const agents: Record<AgentName, Agent> = {
  triage: triageAgent,
  billing: billingAgent,
};
