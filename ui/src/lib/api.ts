import type {
  Job,
  Task,
  SystemStats,
  CreateJobRequest,
  CreateJobResponse,
  PatchWorkersRequest,
  PatchWorkersResponse,
} from '../types/api';

// In dev, Vite proxy routes relative URLs to localhost:3000.
// In prod, set VITE_API_BASE to the API origin (e.g. https://api.example.com).
const BASE: string = (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, init);

  if (!res.ok) {
    let body: unknown;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        body = (await res.json()) as unknown;
      } catch {
        body = await res.text();
      }
    } else {
      body = await res.text();
    }
    throw new ApiError(
      res.status,
      body,
      `API error ${res.status.toString()}: ${path}`
    );
  }

  return res.json() as Promise<T>;
}

/** GET /jobs → { jobs: Job[] } */
export async function listJobs(): Promise<Job[]> {
  const data = await request<{ jobs: Job[] }>('/jobs');
  return data.jobs;
}

/** GET /jobs/:id → Job */
export async function getJob(id: string): Promise<Job> {
  return request<Job>(`/jobs/${id}`);
}

/** GET /jobs/:id/tasks → { tasks: Task[] } (also handles array response) */
export async function getJobTasks(id: string, signal?: AbortSignal): Promise<Task[]> {
  const init: RequestInit = signal != null ? { signal } : {};
  const data = await request<{ tasks: Task[] } | Task[]>(`/jobs/${id}/tasks`, init);
  if (Array.isArray(data)) {
    return data;
  }
  return data.tasks;
}

/** POST /jobs → 202 CreateJobResponse */
export async function createJob(params: CreateJobRequest): Promise<CreateJobResponse> {
  return request<CreateJobResponse>('/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

/** GET /system → SystemStats */
export async function getSystem(): Promise<SystemStats> {
  return request<SystemStats>('/system');
}

/** PATCH /system/workers → PatchWorkersResponse */
export async function patchWorkerCount(count: number): Promise<PatchWorkersResponse> {
  const body: PatchWorkersRequest = { count };
  return request<PatchWorkersResponse>('/system/workers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Returns the URL to download a job result CSV */
export function getResultUrl(id: string): string {
  return `${BASE}/jobs/${id}/result`;
}
