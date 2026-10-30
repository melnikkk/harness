// TODO: use real model tokenization instead of estimating based on character count (tiktoken - https://github.com/openai/tiktoken)
import { generateText, type ModelMessage } from 'ai';
import { model } from './model';

const EXPECTED_TOKEN_LENGTH = 4;

export const MAX_CONTEXT_TOKENS = 500;
export const KEEP_CONTEXT_TOKENS = 200;

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

export function buildContext(
  systemPrompt: string,
  task: string,
  summary: string,
  turns: Array<Array<ModelMessage>>,
): Array<ModelMessage> {
  const contextBaseLine: Array<ModelMessage> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task },
  ];

  if (summary) {
    contextBaseLine[0].content += `\n\nSummary of previous conversation:\n${summary}`;
  }

  for (const turn of turns) {
    contextBaseLine.push(...turn);
  }

  return contextBaseLine;
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
    messages: [
      {
        role: 'system',
        content:
          "You compress an agent's work log into a short running summary. Preserve concrete facts: item ids, categories, draft ids, amounts, and what was already sent. Be terse.",
      },
      {
        role: 'user',
        content: `Prior summary:\n${priorSummary || '(none)'}\n\nFold in this newer work:\n${transcript}\n\nReturn the updated summary.`,
      },
    ],
  });

  return text;
}
