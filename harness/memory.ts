import { generateText, type ModelMessage } from 'ai';
import { model } from './model';
import type { ModelContext } from './types';

const EXPECTED_TOKEN_LENGTH = 4;

const CONTEXT_WINDOW_TOKENS = 200_000;

export const MAX_CONTEXT_TOKENS = CONTEXT_WINDOW_TOKENS * 0.75;
export const KEEP_CONTEXT_TOKENS = CONTEXT_WINDOW_TOKENS * 0.25;

export function estimateTokens(messages: Array<ModelMessage>): number {
  const characters = messages.reduce(
    (acc, message) =>
      acc +
      (typeof message.content === 'string'
        ? message.content.length
        : JSON.stringify(message.content).length),
    0,
  );

  return Math.ceil(characters / EXPECTED_TOKEN_LENGTH);
}

export function estimateContextTokens({ system, messages }: ModelContext): number {
  return estimateTokens([{ role: 'system', content: system }, ...messages]);
}

export function buildContext(
  systemPrompt: string,
  task: string,
  summary: string,
  turns: Array<Array<ModelMessage>>,
): ModelContext {
  const taskMessage: ModelMessage = {
    role: 'user',
    content: summary
      ? `${task}\n\nSummary of the earlier conversation (older steps were compacted):\n${summary}`
      : task,
  };

  return { system: systemPrompt, messages: [taskMessage, ...turns.flat()] };
}

export async function summarize(
  oldTurns: Array<Array<ModelMessage>>,
  priorSummary: string,
): Promise<string> {
  const transcript = oldTurns
    .flat()
    .map(
      (message) =>
        `${message.role}: ${typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}`,
    )
    .join('\n')
    .slice(0, 6000);

  const { text } = await generateText({
    model,
    system:
      "You compress an agent's work log into a short running summary. Preserve concrete facts: item ids, categories, draft ids, amounts, and what was already sent. Be terse.",
    prompt: `Prior summary:\n${priorSummary || '(none)'}\n\nFold in this newer work:\n${transcript}\n\nReturn the updated summary.`,
  });

  return text;
}
