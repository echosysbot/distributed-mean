import { useSystemStore } from '../store/useSystemStore';
import type { WorkerInfo } from '../types/api';
import { shortId } from '../lib/format';

interface WorkerChipProps {
  worker: WorkerInfo;
}

function WorkerChip({ worker }: WorkerChipProps) {
  const dotClass = worker.status === 'idle' ? 'bg-emerald-500' : 'bg-amber-500';
  const borderClass = worker.status === 'idle' ? 'border-emerald-800' : 'border-amber-800';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono bg-slate-950 border ${borderClass}`}
      title={worker.id}
    >
      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
      <span>{shortId(worker.id)}</span>
      <span className="text-slate-500 text-xs">{worker.status}</span>
      {worker.currentTaskId != null && (
        <span className="text-slate-600 text-xs">
          {'→'} task:{shortId(worker.currentTaskId, 6)}
        </span>
      )}
    </div>
  );
}

export function WorkerFleet() {
  const workers = useSystemStore((s) => s.workers);

  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 p-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Worker Fleet
      </h2>
      <div className="flex flex-wrap gap-2 min-h-[60px]">
        {workers.length === 0 ? (
          <span className="text-slate-500 text-sm">No workers connected yet</span>
        ) : (
          workers.map((w) => <WorkerChip key={w.id} worker={w} />)
        )}
      </div>
    </div>
  );
}
