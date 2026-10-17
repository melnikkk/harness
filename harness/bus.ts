import { randomUUID } from 'node:crypto';
import type { AgentEvent, EventInput } from '@shared/events';
import { db, eventLog } from './db';

type Listener = (event: AgentEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export async function emit(input: EventInput): Promise<void> {
  const event: AgentEvent = { ...input, ts: Date.now(), id: randomUUID() };

  await db.insert(eventLog).values({ data: event });

  for (const listener of listeners) {
    listener(event);
  }
}

export async function history(): Promise<Array<AgentEvent>> {
  const rows = await db.select().from(eventLog).orderBy(eventLog.seq);

  return rows.map((row) => row.data);
}
