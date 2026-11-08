import { useCallback, useEffect, useState } from 'react';
import type { AgentEvent } from '@shared/events';
import { API_BASE } from './api/client';

const SSE_URL = `${API_BASE}/events`;

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

  const resetEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, connectionStatus, resetEvents };
}
