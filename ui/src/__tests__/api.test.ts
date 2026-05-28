import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listJobs, createJob, getResultUrl, ApiError } from '../lib/api';

describe('listJobs', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns jobs array on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ jobs: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await listJobs();
    expect(result).toEqual([]);
  });
});

describe('createJob', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends correct request and returns job data', async () => {
    const jobResponse = {
      jobId: 'u1',
      f: 5,
      c: 2,
      status: 'queued',
      batchCount: 1,
      createdAt: '2025-01-01T00:00:00Z',
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(jobResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createJob({ F: 5, C: 2 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/jobs');
    expect(init.method).toBe('POST');
    const parsedBody = JSON.parse(init.body as string) as { F: number; C: number };
    expect(parsedBody).toEqual({ F: 5, C: 2 });
    expect(result.jobId).toBe('u1');
    expect(result.f).toBe(5);
    expect(result.c).toBe(2);
    expect(result.status).toBe('queued');
    expect(result.batchCount).toBe(1);
  });

  it('throws ApiError with status 400 on bad request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ error: 'bad' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const err = await createJob({ F: 5, C: 2 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
  });
});

describe('getResultUrl', () => {
  it('returns correct URL for job id', () => {
    expect(getResultUrl('u1')).toBe('/jobs/u1/result');
  });
});
