import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmitJobForm } from '../components/SubmitJobForm';
import { useJobsStore } from '../store/useJobsStore';
import { useLogStore } from '../store/useLogStore';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  useJobsStore.setState({ jobs: {}, jobTasks: {}, expandedJobs: new Set(), queueDepthHistory: [] });
  useLogStore.setState({ lines: [], filter: 'all' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SubmitJobForm', () => {
  it('submits job and shows success banner', async () => {
    const user = userEvent.setup();
    const jobResponse = {
      jobId: 'new-job-id-1234',
      f: 10,
      c: 5,
      status: 'queued',
      batchCount: 2,
      createdAt: '2025-01-01T00:00:00Z',
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(jobResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<SubmitJobForm />);

    const fInput = screen.getByLabelText('Files (F)');
    const cInput = screen.getByLabelText('Values / file (C)');

    await user.clear(fInput);
    await user.type(fInput, '10');
    await user.clear(cInput);
    await user.type(cInput, '5');

    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { F: number; C: number };
    expect(body.F).toBe(10);
    expect(body.C).toBe(5);

    await waitFor(() => {
      expect(useJobsStore.getState().jobs['new-job-id-1234']).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getByText(/created/i)).toBeInTheDocument();
    });
  });

  it('shows error banner on 400 response', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ error: 'bad request' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<SubmitJobForm />);

    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      const errorEl = screen.getByText('bad request');
      expect(errorEl).toBeInTheDocument();
    });

    await waitFor(() => {
      const logLines = useLogStore.getState().lines;
      const hasError = logLines.some((l) => l.level === 'error');
      expect(hasError).toBe(true);
    });
  });
});
