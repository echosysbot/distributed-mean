import { create } from 'zustand';
import type { WorkerInfo } from '../types/api';

const HISTORY_WINDOW_MS = 120_000; // 2 minutes

interface WorkerSpeedSample {
  t: number;
  busy: boolean;
}

interface SystemState {
  workers: WorkerInfo[];
  queueDepth: number;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  workerSpeedHistory: Record<string, WorkerSpeedSample[]>;
}

interface SystemActions {
  setWorkers: (workers: WorkerInfo[]) => void;
  setQueueDepth: (n: number) => void;
  setConnectionStatus: (s: 'connecting' | 'connected' | 'reconnecting') => void;
}

type SystemStore = SystemState & SystemActions;

function pruneHistory(history: WorkerSpeedSample[]): WorkerSpeedSample[] {
  const cutoff = Date.now() - HISTORY_WINDOW_MS;
  return history.filter((s) => s.t >= cutoff);
}

export const useSystemStore = create<SystemStore>((set) => ({
  workers: [],
  queueDepth: 0,
  connectionStatus: 'connecting',
  workerSpeedHistory: {},

  setWorkers: (workers) => {
    set((state) => {
      const now = Date.now();
      const updated: Record<string, WorkerSpeedSample[]> = { ...state.workerSpeedHistory };
      for (const worker of workers) {
        const existing = pruneHistory(updated[worker.id] ?? []);
        updated[worker.id] = [...existing, { t: now, busy: worker.status === 'busy' }];
      }
      return { workers, workerSpeedHistory: updated };
    });
  },

  setQueueDepth: (n) => set({ queueDepth: n }),

  setConnectionStatus: (s) => set({ connectionStatus: s }),
}));
