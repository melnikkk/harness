import { useCallback, useEffect, useState } from 'react';
import type { AgentEvent, SubmitTaskRequest } from '@shared/events';

const SSE_URL = `http://${location.hostname}:8787/api/events`;

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
}

export function useHarnessSSE() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.DISCONNECTED);

  useEffect(() => {
    setEvents([]);

    const sseConnection = new EventSource(SSE_URL);

    sseConnection.onopen = () => setConnectionStatus(ConnectionStatus.CONNECTED);

    sseConnection.onerror = () => {
      const readyState = sseConnection.readyState;

      if (readyState === EventSource.CONNECTING) {
        setConnectionStatus(ConnectionStatus.RECONNECTING);

        return;
      }

      setConnectionStatus(ConnectionStatus.DISCONNECTED);
    };

    sseConnection.onmessage = (e) => {
      const event = JSON.parse(e.data) as AgentEvent;

      setEvents((prev) => [...prev, event]);
    };

    return () => sseConnection.close();
  }, []);

  const send = useCallback(async ({ input, mode }: SubmitTaskRequest): Promise<void> => {
    let response: Response;

    try {
      response = await fetch(`http://${location.hostname}:8787/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, mode }),
      });
    } catch {
      throw new Error('Cannot reach the server');
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      throw new Error(body?.error ?? `Request failed (${response.status})`);
    }
  }, []);

  const resetEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, connectionStatus, send, resetEvents };
}
