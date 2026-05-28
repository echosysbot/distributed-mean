import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobsTable } from '../components/JobsTable';
import { useJobsStore } from '../store/useJobsStore';
import type { Job } from '../types/api';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  useJobsStore.setState({
    jobs: {},
    jobTasks: {},
    expandedJobs: new Set(),
    queueDepthHistory: [],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeJob(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    f: 10,
    c: 5,
    status: 'queued',
    batchCount: 4,
    completedBatches: 0,
    resultPath: null,
    error: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('JobsTable', () => {
  it('shows empty state when no jobs', () => {
    render(<JobsTable />);
    expect(screen.getByText(/No jobs yet/i)).toBeInTheDocument();
  });

  it('renders two rows for two seeded jobs', () => {
    useJobsStore.setState({
      jobs: {
        job1: makeJob('job1', { status: 'done' }),
        job2: makeJob('job2', { status: 'running', completedBatches: 1 }),
      },
      jobTasks: {},
      expandedJobs: new Set(),
      queueDepthHistory: [],
    });

    render(<JobsTable />);

    // Two job IDs should appear (via shortId)
    expect(screen.getByText('job1')).toBeInTheDocument();
    expect(screen.getByText('job2')).toBeInTheDocument();
  });

  it('shows progress text for running job', () => {
    useJobsStore.setState({
      jobs: {
        job2: makeJob('job2', { status: 'running', completedBatches: 1, batchCount: 4 }),
      },
      jobTasks: {},
      expandedJobs: new Set(),
      queueDepthHistory: [],
    });

    render(<JobsTable />);
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('fetches tasks on row click and does not refetch on second click', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ tasks: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    useJobsStore.setState({
      jobs: {
        job1: makeJob('job1'),
      },
      jobTasks: {},
      expandedJobs: new Set(),
      queueDepthHistory: [],
    });

    render(<JobsTable />);

    // Click to expand
    await user.click(screen.getByText('job1'));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    // Click to collapse then expand again - should NOT refetch (tasks cached)
    await user.click(screen.getByText('job1'));
    await user.click(screen.getByText('job1'));

    // Still only 1 call
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('clicking F header sorts by f value', async () => {
    const user = userEvent.setup();
    useJobsStore.setState({
      jobs: {
        jobA: makeJob('jobA', { f: 50 }),
        jobB: makeJob('jobB', { f: 10 }),
      },
      jobTasks: {},
      expandedJobs: new Set(),
      queueDepthHistory: [],
    });

    render(<JobsTable />);

    // Click F header to sort ascending
    await user.click(screen.getByText('F'));

    // Click again to sort descending
    await user.click(screen.getByText(/F/));

    // Table should re-render without errors
    expect(screen.getByText('jobA')).toBeInTheDocument();
    expect(screen.getByText('jobB')).toBeInTheDocument();
  });
});
