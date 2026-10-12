import { randomUUID } from "node:crypto";
import { EventType, type Emit } from "@shared/events";

export async function runAgent(opts: { input: string; emit: Emit }): Promise<void> {
  const { input, emit } = opts;
  const workflowId = randomUUID();

  emit({ type: EventType.WorkflowStarted, workflowId, input });

  emit({
    type: EventType.Log,
    workflowId,
    level: "warn",
    message:
      "No agent yet. You build the brittle agent loop in Lesson 1 (harness/runtime.ts).",
  });

  emit({ type: EventType.WorkflowCompleted, workflowId, output: "(no agent implemented yet)" });
}
