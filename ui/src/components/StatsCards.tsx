import { useSystemStore } from '../store/useSystemStore';
import { useJobsStore } from '../store/useJobsStore';

interface StatCardProps {
  label: string;
  value: number;
  valueClass?: string;
}

function StatCard({ label, value, valueClass = 'text-slate-100' }: StatCardProps) {
  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 p-4 text-center">
      <div className={`text-3xl font-bold leading-none ${valueClass}`}>{value}</div>
      <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

export function StatsCards() {
  const workers = useSystemStore((s) => s.workers);
  const queueDepth = useSystemStore((s) => s.queueDepth);
  const jobs = useJobsStore((s) => s.jobs);

  const totalWorkers = workers.length;
  const idle = workers.filter((w) => w.status === 'idle').length;
  const busy = workers.filter((w) => w.status === 'busy').length;
  const jobValues = Object.values(jobs);
  const done = jobValues.filter((j) => j.status === 'done').length;
  const total = jobValues.length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="Workers" value={totalWorkers} />
      <StatCard label="Idle" value={idle} valueClass="text-emerald-400" />
      <StatCard label="Busy" value={busy} valueClass="text-amber-400" />
      <StatCard label="Queue Depth" value={queueDepth} valueClass="text-indigo-400" />
      <StatCard label="Jobs Done" value={done} valueClass="text-emerald-400" />
      <StatCard label="Total Jobs" value={total} />
    </div>
  );
}
