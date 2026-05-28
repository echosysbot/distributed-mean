import { useEffect, useRef } from 'react';
import type { SSEEvent } from '../types/sse';
import { useSystemStore } from '../store/useSystemStore';
import { useJobsStore } from '../store/useJobsStore';
import { useLogStore } from '../store/useLogStore';

const RECONNECT_DELAY_MS = 3000;

function isSSEEvent(value: unknown): value is SSEEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as Record<string, unknown>)['type'] === 'string'
  );
}

export function useSSE(): void {
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect(): void {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const es = new EventSource('/events');
      esRef.current = es;

      es.onopen = () => {
        useSystemStore.getState().setConnectionStatus('connected');
      };

      es.onmessage = (event: MessageEvent) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data as string) as unknown;
        } catch {
          return;
        }

        if (!isSSEEvent(parsed)) return;

        const sseEvent = parsed;

        switch (sseEvent.type) {
          case 'worker_update':
            useSystemStore.getState().setWorkers(sseEvent.workers);
            break;
          case 'job_update':
            useJobsStore.getState().upsertJob(sseEvent.job);
            break;
          case 'queue_depth':
            useSystemStore.getState().setQueueDepth(sseEvent.depth);
            useJobsStore.getState().pushQueueDepthSample(Date.now(), sseEvent.depth);
            break;
          case 'log':
            useLogStore.getState().addLine(sseEvent.level, sseEvent.message, sseEvent.timestamp);
            break;
          case 'task_completed':
            // Reserved for future counter tracking
            break;
          case 'connected':
            // Initial handshake — no-op
            break;
        }
      };

      es.onerror = () => {
        useSystemStore.getState().setConnectionStatus('reconnecting');
        es.close();
        esRef.current = null;
        timerRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);
}
