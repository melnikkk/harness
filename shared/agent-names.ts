export const AGENT_NAMES = {
  TRIAGE: 'triage',
  BILLING: 'billing',
} as const;

export type AgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];
