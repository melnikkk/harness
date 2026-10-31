import { DBOS } from '@dbos-inc/dbos-sdk';
import { type JSONValue, type ModelMessage, streamText, type ToolSet } from 'ai';
import { EventType } from '@shared/events';
import { model } from './model';
import { runTool } from './tools';
import type { ToolCall, Turn } from './types';
import { emit } from './bus';
import {
  buildContext,
  estimateTokens,
  KEEP_CONTEXT_TOKENS,
  MAX_CONTEXT_TOKENS,
  summarize,
} from './memory';
import { agents, triageAgent } from './agent';
import type { AgentName } from './agent-names';

const MAX_STEPS = 10;
const NEEDS_APPROVAL = new Set(['issueRefund']);
const APPROVAL_TIMEOUT_IN_S = 86400;

async function modelTurn(
  workflowId: string,
  messages: Array<ModelMessage>,
  agentTools: ToolSet,
): Promise<Turn> {
  const result = streamText({
    model,
    messages,
    tools: agentTools,
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

function toolResultMessage(toolCall: ToolCall, value: JSONValue): ModelMessage {
  const { toolName, toolCallId } = toolCall;

  return {
    role: 'tool',
    content: [
      {
        toolCallId,
        toolName,
        type: 'tool-result',
        output: { type: 'json', value },
      },
    ],
  };
}

export async function agentWorkflow(opts: { input: string }): Promise<string> {
  const { input } = opts;
  const workflowId = DBOS.workflowID ?? 'unknown';

  await DBOS.runStep(() => emit({ type: EventType.WorkflowStarted, workflowId, input }), {
    name: 'started',
  });

  const turns: Array<Array<ModelMessage>> = [];
  let summary = '';
  let currentAgent = triageAgent;

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

        const contextTokens = estimateTokens(
          buildContext(currentAgent.systemPrompt, input, summary, turns),
        );

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

    const context = buildContext(currentAgent.systemPrompt, input, summary, turns);

    const turn = await DBOS.runStep(() => modelTurn(workflowId, context, currentAgent.tools), {
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
      const { toolName, toolCallId } = call;

      if (toolName === 'handoff') {
        const toAgent = String(call.input.to ?? '');

        if (toAgent) {
          // TODO: improve type safety
          const to = toAgent as AgentName;

          const reason = String(call.input.reason ?? '');
          const from = currentAgent.name;

          await DBOS.runStep(
            () => emit({ type: EventType.AgentHandoff, workflowId, from, to, reason }),
            { name: `agent-handoff-step-${step}` },
          );

          currentAgent = agents[to] ?? currentAgent;
          turnMessages.push(toolResultMessage(call, { ok: true, handedOffTo: to, reason }));
        }
      } else if (NEEDS_APPROVAL.has(call.toolName)) {
        await DBOS.runStep(
          () =>
            emit({
              workflowId,
              toolCallId,
              type: EventType.ApprovalRequested,
              action: toolName,
              args: input,
            }),
          { name: `approval-requested-step-${step}` },
        );

        const decision = await DBOS.recv<{ approved: boolean }>('approval', APPROVAL_TIMEOUT_IN_S);
        const approved = decision?.approved ?? false;

        await DBOS.runStep(
          () => emit({ type: EventType.ApprovalResolved, workflowId, toolCallId, approved }),
          { name: `approval-decision-step-${step}` },
        );

        if (approved) {
          const output = await DBOS.runStep(() => toolStep(workflowId, call), {
            name: `tool-${call.toolCallId}`,
          });

          turnMessages.push(toolResultMessage(call, output as JSONValue));
        } else {
          turnMessages.push(toolResultMessage(call, { approved: false, reason: 'not approved' }));
        }
      } else {
        const output = await DBOS.runStep(() => toolStep(workflowId, call), {
          name: `tool-${call.toolCallId}`,
        });

        turnMessages.push({
          role: 'tool',
          content: [
            {
              toolCallId,
              toolName,
              type: 'tool-result',
              output: { type: 'json', value: output as JSONValue },
            },
          ],
        });
      }
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
