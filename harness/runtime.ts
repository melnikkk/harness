import { DBOS } from '@dbos-inc/dbos-sdk';
import { type JSONValue, type ModelMessage, streamText } from 'ai';
import { EventType } from '@shared/events';
import { model } from './model';
import { runTool, tools } from './tools';
import type { ToolCall, Turn } from './types';
import { emit } from './bus';
import {
  buildContext,
  estimateTokens,
  KEEP_CONTEXT_TOKENS,
  MAX_CONTEXT_TOKENS,
  summarize,
} from './memory';

const MAX_STEPS = 10;

async function modelTurn(workflowId: string, messages: Array<ModelMessage>): Promise<Turn> {
  const result = streamText({
    model,
    messages,
    tools,
  });

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      await emit({
        type: EventType.ModelDelta,
        text: part.text,
        workflowId,
      });
    }
  }

  const rowCalls = await result.toolCalls;

  return {
    text: await result.text,
    toolCalls: rowCalls.map((call) => ({
      toolName: call.toolName,
      input: call.input as Record<string, JSONValue>,
      toolCallId: call.toolCallId,
    })),
    responseMessages: (await result.response).messages,
  };
}

async function toolStep(workflowId: string, call: ToolCall): Promise<Record<string, unknown>> {
  const { toolName, input, toolCallId } = call;

  await emit({
    type: EventType.ToolRequested,
    toolCallId,
    name: toolName,
    args: input,
    workflowId,
  });

  const output = await runTool(toolName, input);

  await emit({
    type: EventType.ToolCompleted,
    result: output,
    toolCallId,
    workflowId,
  });

  return output;
}

export async function agentWorkflow(opts: { input: string }): Promise<string> {
  const { input } = opts;
  const workflowId = DBOS.workflowID ?? 'unknown';

  await DBOS.runStep(() => emit({ type: EventType.WorkflowStarted, workflowId, input }), {
    name: 'started',
  });

  let turns: Array<Array<ModelMessage>> = [];
  let summary = '';

  let step = 0;
  while (step < MAX_STEPS) {
    const estimatedTokens = estimateTokens(turns.flat());

    if (estimatedTokens > MAX_CONTEXT_TOKENS) {
      const oldTurns: Array<Array<ModelMessage>> = [];

      while (turns.length > 1 && estimateTokens(turns.flat()) > KEEP_CONTEXT_TOKENS) {
        const oldestTurn = turns.shift();

        if (oldestTurn) {
          oldTurns.push(oldestTurn);
        }
      }

      if (oldTurns.length > 0) {
        summary = await DBOS.runStep(() => summarize(oldTurns, summary), {
          name: `summarize-step-${step}`,
        });

        const contextTokens = estimateTokens(buildContext(input, summary, turns));

        await DBOS.runStep(
          () =>
            emit({
              type: EventType.MemoryCompacted,
              workflowId,
              summarizedTurns: oldTurns.length,
              contextTokens,
              summary,
            }),
          { name: `context-compacted-step-${step}` },
        );
      }
    }

    const context = buildContext(input, summary, turns);

    const turn = await DBOS.runStep(() => modelTurn(workflowId, context), {
      name: `model-turn-${step}`,
    });

    const turnMessages: Array<ModelMessage> = [...turn.responseMessages];

    if (turn.toolCalls.length === 0) {
      await DBOS.runStep(
        () => emit({ type: EventType.ModelCompleted, workflowId, text: turn.text }),
        { name: `model-done-step-${step}` },
      );

      await DBOS.runStep(
        () => emit({ type: EventType.WorkflowCompleted, workflowId, output: turn.text }),
        { name: `workflow-completed-step-${step}` },
      );

      return turn.text;
    }

    for (const call of turn.toolCalls) {
      const output = await DBOS.runStep(() => toolStep(workflowId, call), {
        name: `tool-${call.toolCallId}`,
      });

      turnMessages.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            output: { type: 'json', value: output as JSONValue },
          },
        ],
      });
    }

    turns.push(turnMessages);

    step++;
  }

  await DBOS.runStep(
    () => emit({ type: EventType.WorkflowFailed, workflowId, error: 'Hit max steps' }),
    {
      name: 'workflow-failed',
    },
  );

  return '';
}

export const runAgentWorkflow = DBOS.registerWorkflow(agentWorkflow, {
  name: 'agent-workflow',
});
