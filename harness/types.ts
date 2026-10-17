import type { ModelMessage } from 'ai';

export type ToolCall = {
  toolName: string;
  input: Record<string, unknown>;
  toolCallId: string;
};

export type Turn = {
  text: string;
  toolCalls: Array<ToolCall>;
  responseMessages: Array<ModelMessage>;
};
