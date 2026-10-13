import { streamText, type ModelMessage } from 'ai';
import { randomUUID } from 'node:crypto';
import { EventType, type Emit } from '@shared/events';
import { SYSTEM_PROMPT } from './system-prompt';
import { model } from './model';
import { tools } from './tools';

const MAX_STEPS = 10;

export async function runAgent(opts: { input: string; emit: Emit }): Promise<void> {
  const { input, emit } = opts;
  const workflowId = randomUUID();

  emit({ type: EventType.WorkflowStarted, workflowId, input });

  const messages: Array<ModelMessage> = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: input },
  ];

  let step = 0;

  while (step < MAX_STEPS) {
    const result = streamText({
      model,
      messages,
      tools,
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          emit({
            type: EventType.ModelDelta,
            text: part.text,
            workflowId,
          });
          break;
        case 'tool-call':
          emit({
            type: EventType.ToolRequested,
            toolCallId: part.toolCallId,
            name: part.toolName,
            args: part.input,
            workflowId,
          });
          break;
        case 'tool-result':
          emit({
            type: EventType.ToolCompleted,
            toolCallId: part.toolCallId,
            result: part.output,
            workflowId,
          });
          break;
        case 'error':
          emit({
            type: EventType.WorkflowFailed,
            error: String(part.error),
            workflowId,
          });
          break;
      }
    }

    messages.push(...(await result.response).messages);

    const toolCalls = await result.toolCalls;

    if (toolCalls.length === 0) {
      const text = await result.text;

      emit({ type: EventType.ModelCompleted, workflowId, text });
      emit({ type: EventType.WorkflowCompleted, workflowId, output: text });

      return;
    }

    step++;
  }

  emit({ type: EventType.WorkflowFailed, workflowId, error: 'Hit max steps' });
}
