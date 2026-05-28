import type { Task } from '../types/api';
import { StatusBadge } from './StatusBadge';
import { formatElapsed, shortId } from '../lib/format';

interface JobTaskRowsProps {
  jobId: string;
  tasks: Task[] | undefined;
  loading: boolean;
  error: string | null;
  colSpan: number;
}

export function JobTaskRows({ tasks, loading, error, colSpan }: JobTaskRowsProps) {
  if (loading && tasks === undefined) {
    return (
      <tr>
        <td
          colSpan={colSpan}
          className="bg-slate-900 text-slate-500 italic px-3 py-2 text-xs border-b border-slate-800"
        >
          Loading tasks…
        </td>
      </tr>
    );
  }

  if (error !== null) {
    return (
      <tr>
        <td
          colSpan={colSpan}
          className="text-red-400 px-3 py-2 text-xs border-b border-slate-800"
        >
          {error}
        </td>
      </tr>
    );
  }

  if (tasks === undefined || tasks.length === 0) {
    return (
      <tr>
        <td
          colSpan={colSpan}
          className="bg-slate-900 text-slate-500 italic px-3 py-2 text-xs border-b border-slate-800"
        >
          No tasks found.
        </td>
      </tr>
    );
  }

  return (
    <>
      {tasks.map((t) => {
        const elapsedOrRunning =
          t.startedAt != null && t.completedAt == null
            ? 'running…'
            : formatElapsed(t.startedAt, t.completedAt);

        return (
          <tr key={t.id} className="bg-slate-950 text-xs">
            <td className="px-3 py-1.5 border-b border-slate-800 pl-10 font-mono text-slate-400">
              {shortId(t.id)}
            </td>
            <td className="px-3 py-1.5 border-b border-slate-800">
              <StatusBadge status={t.status} kind="task" />
            </td>
            <td
              colSpan={2}
              className="px-3 py-1.5 border-b border-slate-800 text-slate-500"
            >
              files {t.fileStart}–{t.fileEnd}
            </td>
            <td className="px-3 py-1.5 border-b border-slate-800 text-slate-500 font-mono">
              {t.workerId != null ? shortId(t.workerId) : '—'}
            </td>
            <td className="px-3 py-1.5 border-b border-slate-800 font-mono text-slate-400">
              {elapsedOrRunning}
            </td>
            <td className="px-3 py-1.5 border-b border-slate-800" />
          </tr>
        );
      })}
    </>
  );
}
