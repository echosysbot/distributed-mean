import { create } from 'zustand';
import type { Job, Task, JobStatus } from '../types/api';

const HISTORY_WINDOW_MS = 120_000; // 2 minutes

interface QueueDepthSample {
  t: number;
  depth: number;
}

interface JobsState {
  jobs: Record<string, Job>;
  jobTasks: Record<string, Task[]>;
  expandedJobs: Set<string>;
  queueDepthHistory: QueueDepthSample[];
}

interface JobsActions {
  upsertJob: (partial: Partial<Job> & { id: string }) => void;
  setJobs: (list: Job[]) => void;
  setJobTasks: (jobId: string, tasks: Task[]) => void;
  clearJobTasks: (jobId: string) => void;
  toggleExpanded: (jobId: string) => void;
  pushQueueDepthSample: (t: number, depth: number) => void;
}

type JobsStore = JobsState & JobsActions;

export type { JobStatus };

/** Returns jobs sorted by createdAt descending */
export function selectJobList(state: JobsStore): Job[] {
  return Object.values(state.jobs).sort((a, b) => {
    const aTime = a.createdAt != null ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt != null ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

/** Returns counts by status */
export function selectJobStats(state: JobsStore): Record<JobStatus | 'total', number> {
  const jobs = Object.values(state.jobs);
  return {
    total: jobs.length,
    generating: jobs.filter((j) => j.status === 'generating').length,
    queued: jobs.filter((j) => j.status === 'queued').length,
    running: jobs.filter((j) => j.status === 'running').length,
    aggregating: jobs.filter((j) => j.status === 'aggregating').length,
    done: jobs.filter((j) => j.status === 'done').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };
}

export const useJobsStore = create<JobsStore>((set) => ({
  jobs: {},
  jobTasks: {},
  expandedJobs: new Set<string>(),
  queueDepthHistory: [],

  upsertJob: (partial) => {
    set((state) => {
      const existing: Job | Record<string, never> = state.jobs[partial.id] ?? {};
      const merged = { ...existing, ...partial } as Job;
      return { jobs: { ...state.jobs, [partial.id]: merged } };
    });
  },

  setJobs: (list) => {
    set({
      jobs: Object.fromEntries(list.map((j) => [j.id, j])),
    });
  },

  setJobTasks: (jobId, tasks) => {
    set((state) => ({
      jobTasks: { ...state.jobTasks, [jobId]: tasks },
    }));
  },

  clearJobTasks: (jobId) => {
    set((state) => {
      const { [jobId]: _, ...rest } = state.jobTasks;
      return { jobTasks: rest };
    });
  },

  toggleExpanded: (jobId) => {
    set((state) => {
      const next = new Set(state.expandedJobs);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return { expandedJobs: next };
    });
  },

  pushQueueDepthSample: (t, depth) => {
    set((state) => {
      const cutoff = Date.now() - HISTORY_WINDOW_MS;
      const trimmed = state.queueDepthHistory.filter((s) => s.t >= cutoff);
      return { queueDepthHistory: [...trimmed, { t, depth }] };
    });
  },
}));
