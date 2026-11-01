import type { ModelMessage } from 'ai';

export type ToolCall = {
  toolName: string;
  input: Record<string, unknown>;
  toolCallId: string;
};

export type ModelContext = {
  system: string;
  messages: Array<ModelMessage>;
};

export type Turn = {
  text: string;
  toolCalls: Array<ToolCall>;
  responseMessages: Array<ModelMessage>;
  usage: {
    inputTokens?: number;
  };
};

export type SandboxResult =
  | { ok: true; result: unknown; logs: Array<string> }
  | { ok: false; error: string; logs: Array<string> };

export type SandboxApi = Record<string, (...args: Array<any>) => unknown>;
