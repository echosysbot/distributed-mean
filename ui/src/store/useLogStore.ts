import { create } from 'zustand';
import type { LogLevel } from '../types/sse';

export const MAX_LOG_LINES = 200;

interface LogLine {
  id: string;
  level: LogLevel;
  message: string;
  ts: string;
}

interface LogState {
  lines: LogLine[];
  filter: 'all' | LogLevel;
}

interface LogActions {
  addLine: (level: LogLevel, message: string, timestamp?: string) => void;
  setFilter: (f: 'all' | LogLevel) => void;
  clear: () => void;
}

type LogStore = LogState & LogActions;

/** Returns lines matching the current filter */
export function selectFilteredLines(state: LogStore): LogLine[] {
  if (state.filter === 'all') return state.lines;
  return state.lines.filter((l) => l.level === state.filter);
}

export const useLogStore = create<LogStore>((set) => ({
  lines: [],
  filter: 'all',

  addLine: (level, message, timestamp) => {
    const ts = timestamp ?? new Date().toISOString();
    const id = crypto.randomUUID();
    set((state) => {
      const next = [...state.lines, { id, level, message, ts }];
      return { lines: next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next };
    });
  },

  setFilter: (f) => set({ filter: f }),

  clear: () => set({ lines: [] }),
}));
