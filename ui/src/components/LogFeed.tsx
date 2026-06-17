import { useEffect, useRef } from 'react';
import { useLogStore, selectFilteredLines } from '../store/useLogStore';
import type { LogLevel } from '../types/sse';

type FilterOption = 'all' | LogLevel;

const FILTER_OPTIONS: FilterOption[] = ['all', 'info', 'warn', 'error'];

const levelColor: Record<LogLevel, string> = {
  info: 'text-slate-300',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

export function LogFeed() {
  const filter = useLogStore((s) => s.filter);
  const filteredLines = useLogStore(selectFilteredLines);

  const containerRef = useRef<HTMLDivElement>(null);
  const wasNearBottom = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (wasNearBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [filteredLines.length]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    wasNearBottom.current = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
  }

  return (
    <>
      <div className="flex gap-1 mb-3">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => { useLogStore.getState().setFilter(opt); }}
            className={`px-2 py-0.5 rounded text-xs border border-slate-700 cursor-pointer ${
              filter === opt
                ? 'bg-slate-700 text-slate-200'
                : 'bg-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {opt}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { useLogStore.getState().clear(); }}
          className="ml-2 px-2 py-0.5 rounded text-xs border border-slate-700 bg-transparent text-slate-500 hover:text-slate-300 cursor-pointer"
        >
          Clear
        </button>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-56 bg-slate-950 rounded-md font-mono text-xs p-3 overflow-y-auto"
      >
        {filteredLines.map((line) => (
          <div key={line.id} className="py-px leading-relaxed">
            <span className="text-slate-600 select-none">
              {new Date(line.ts).toLocaleTimeString()}
            </span>{' '}
            <span className={levelColor[line.level]}>{line.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
