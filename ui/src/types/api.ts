// Mirrors api/src/types/index.ts — Date fields become string | null over JSON

export type JobStatus =
  | 'generating'
  | 'queued'
  | 'running'
  | 'aggregating'
  | 'done'
  | 'failed';

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  f: number;
  c: number;
  status: JobStatus;
  batchCount: number;
  completedBatches: number;
  resultPath: string | null;
  error: string | null;
  /** ISO timestamp string over JSON */
  createdAt: string | null;
  /** ISO timestamp string over JSON */
  updatedAt: string | null;
  /** ISO timestamp string over JSON; null until job completes */
  completedAt: string | null;
}

export interface Task {
  id: string;
  jobId: string;
  batchIndex: number;
  fileStart: number;
  fileEnd: number;
  status: TaskStatus;
  workerId: string | null;
  /** ISO timestamp string over JSON */
  startedAt: string | null;
  /** ISO timestamp string over JSON */
  completedAt: string | null;
  error: string | null;
}

export interface WorkerInfo {
  id: string;
  status: 'idle' | 'busy';
  currentTaskId: string | null;
}

export interface SystemStats {
  workers: WorkerInfo[];
  workerCount: number;
  idleWorkers: number;
  busyWorkers: number;
  queueDepth: number;
  jobStats: {
    total: number;
    generating: number;
    queued: number;
    running: number;
    aggregating: number;
    done: number;
    failed: number;
  };
}

export interface CreateJobRequest {
  F: number;
  C: number;
}

export interface CreateJobResponse {
  jobId: string;
  f: number;
  c: number;
  status: JobStatus;
  batchCount: number;
  createdAt: string;
}

export interface PatchWorkersRequest {
  count: number;
}

export interface PatchWorkersResponse {
  ok: true;
  targetWorkerCount: number;
}
