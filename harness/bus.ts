import { randomUUID } from 'node:crypto';
import type { AgentEvent, EventInput } from '@shared/events';
import type { Entry } from './types';
import { db, eventLog } from './db';

type Listener = (entry: Entry) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export async function emit(input: EventInput): Promise<void> {
  const event: AgentEvent = { ...input, ts: Date.now(), id: randomUUID() };

  const [entry] = await db.insert(eventLog).values({ data: event }).returning();

  for (const listener of listeners) {
    listener(entry);
  }
}
