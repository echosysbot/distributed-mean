import React, { useMemo, useState } from 'react';
import { useJobsStore } from '../store/useJobsStore';
import { getResultUrl } from '../lib/api';
import { formatElapsed, shortId } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import { JobTaskRows } from './JobTaskRows';
import { useJobTasks } from '../hooks/useJobTasks';
import type { Job } from '../types/api';

type SortKey = 'createdAt' | 'status' | 'f' | 'c' | 'progress';
type SortDir = 'asc' | 'desc';

function getProgress(j: Job): number {
  if (j.batchCount == null || j.batchCount === 0) return 0;
  return (j.completedBatches ?? 0) / j.batchCount;
}

function sortJobs(jobs: Job[], key: SortKey, dir: SortDir): Job[] {
  const multiplier = dir === 'asc' ? 1 : -1;
  return [...jobs].sort((a, b) => {
    let diff = 0;
    switch (key) {
      case 'createdAt': {
        const at = a.createdAt != null ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt != null ? new Date(b.createdAt).getTime() : 0;
        diff = at - bt;
        break;
      }
      case 'status':
        diff = a.status.localeCompare(b.status);
        break;
      case 'f':
        diff = a.f - b.f;
        break;
      case 'c':
        diff = a.c - b.c;
        break;
      case 'progress':
        diff = getProgress(a) - getProgress(b);
        break;
    }
    return diff * multiplier;
  });
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

function SortHeader({ label, sortKey, activeSortKey, sortDir, onSort }: SortHeaderProps) {
  const isActive = activeSortKey === sortKey;
  const arrow = isActive ? (sortDir === 'asc' ? ' ▴' : ' ▾') : '';
  return (
    <th
      className="text-left px-3 py-2 text-slate-400 font-semibold text-xs uppercase tracking-wide border-b border-slate-700 cursor-pointer select-none hover:text-slate-200"
      onClick={() => { onSort(sortKey); }}
    >
      {label}
      {arrow !== '' && (
        <span className="text-indigo-400">{arrow}</span>
      )}
    </th>
  );
}

interface JobRowProps {
  job: Job;
  expanded: boolean;
}

function JobRow({ job, expanded }: JobRowProps) {
  const { loading, error } = useJobTasks(job.id, expanded);
  const tasks = useJobsStore((s) => s.jobTasks[job.id]);
  const pct = job.batchCount != null && job.batchCount > 0
    ? Math.round(((job.completedBatches ?? 0) / job.batchCount) * 100)
    : 0;

  return (
    <React.Fragment key={job.id}>
      <tr
        className="cursor-pointer hover:bg-slate-900 border-b border-slate-800"
        onClick={() => { useJobsStore.getState().toggleExpanded(job.id); }}
      >
        <td className="px-3 py-2 font-mono text-slate-300 text-sm">
          <span className="text-indigo-400 text-xs mr-1">{expanded ? '▾' : '▸'}</span>
          {shortId(job.id)}
        </td>
        <td className="px-3 py-2">
          <StatusBadge status={job.status} />
        </td>
        <td className="px-3 py-2 text-slate-300 text-sm">{job.f}</td>
        <td className="px-3 py-2 text-slate-300 text-sm">{job.c}</td>
        <td className="px-3 py-2 text-slate-300 text-sm min-w-24">
          <span className="text-xs">{job.completedBatches ?? 0}/{job.batchCount ?? '?'}</span>
          <div className="h-1 bg-slate-700 rounded mt-1">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded"
              style={{ width: `${pct.toString()}%` }}
            />
          </div>
        </td>
        <td className="px-3 py-2 font-mono text-slate-400 text-xs">
          {formatElapsed(job.createdAt, job.completedAt)}
        </td>
        <td className="px-3 py-2">
          {job.status === 'done' ? (
            <a
              href={getResultUrl(job.id)}
              download
              className="text-indigo-400 text-xs hover:underline"
              onClick={(e) => { e.stopPropagation(); }}
            >
              ⬇ CSV
            </a>
          ) : (
            <span className="text-slate-600 text-sm">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <JobTaskRows
          jobId={job.id}
          tasks={tasks}
          loading={loading}
          error={error}
          colSpan={7}
        />
      )}
    </React.Fragment>
  );
}

export function JobsTable() {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const jobs = useJobsStore((s) => s.jobs);
  const expandedJobs = useJobsStore((s) => s.expandedJobs);

  const jobList = useMemo(() => {
    return sortJobs(Object.values(jobs), sortKey, sortDir);
  }, [jobs, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (jobList.length === 0) {
    return (
      <div className="text-slate-500 text-center py-8">
        No jobs yet — submit one above!
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="text-left px-3 py-2 text-slate-400 font-semibold text-xs uppercase tracking-wide border-b border-slate-700">
            Job ID
          </th>
          <SortHeader
            label="Status"
            sortKey="status"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label="F"
            sortKey="f"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label="C"
            sortKey="c"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label="Progress"
            sortKey="progress"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label="Duration"
            sortKey="createdAt"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <th className="text-left px-3 py-2 text-slate-400 font-semibold text-xs uppercase tracking-wide border-b border-slate-700">
            Result
          </th>
        </tr>
      </thead>
      <tbody>
        {jobList.map((j) => (
          <JobRow key={j.id} job={j} expanded={expandedJobs.has(j.id)} />
        ))}
      </tbody>
    </table>
  );
}
