import type { JobStatus, TaskStatus } from '../types/api';

const JOB_STATUS_CLASSES: Record<JobStatus, string> = {
  generating: 'bg-sky-900 text-sky-300',
  queued: 'bg-stone-900 text-stone-300',
  running: 'bg-emerald-950 text-emerald-300',
  aggregating: 'bg-violet-950 text-violet-300',
  done: 'bg-emerald-950 text-emerald-400',
  failed: 'bg-red-950 text-red-300',
};

const TASK_STATUS_CLASSES: Record<TaskStatus, string> = {
  pending: 'bg-stone-900 text-stone-300',
  running: 'bg-emerald-950 text-emerald-300',
  done: 'bg-emerald-950 text-emerald-400',
  failed: 'bg-red-950 text-red-300',
};

interface StatusBadgeProps {
  status: JobStatus | TaskStatus;
  kind?: 'job' | 'task';
}

export function StatusBadge({ status, kind = 'job' }: StatusBadgeProps) {
  const colorClass =
    kind === 'task'
      ? (TASK_STATUS_CLASSES[status as TaskStatus] ?? 'bg-slate-800 text-slate-300')
      : (JOB_STATUS_CLASSES[status as JobStatus] ?? 'bg-slate-800 text-slate-300');

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {status}
    </span>
  );
}
