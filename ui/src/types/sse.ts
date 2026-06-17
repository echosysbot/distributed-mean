import type { Job, WorkerInfo } from './api';

export type LogLevel = 'info' | 'warn' | 'error';

export type SSEEvent =
  | { type: 'worker_update'; workers: WorkerInfo[] }
  | { type: 'job_update'; job: Partial<Job> & { id: string } }
  | { type: 'queue_depth'; depth: number }
  | { type: 'log'; level: LogLevel; message: string; timestamp: string }
  | { type: 'task_completed' }
  | { type: 'connected' };
