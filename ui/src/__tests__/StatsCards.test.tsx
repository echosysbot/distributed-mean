import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsCards } from '../components/StatsCards';
import { useSystemStore } from '../store/useSystemStore';
import { useJobsStore } from '../store/useJobsStore';
import type { Job } from '../types/api';

beforeEach(() => {
  useSystemStore.setState({
    workers: [],
    queueDepth: 0,
    connectionStatus: 'connecting',
    workerSpeedHistory: {},
  });
  useJobsStore.setState({
    jobs: {},
    jobTasks: {},
    expandedJobs: new Set(),
    queueDepthHistory: [],
  });
});

function makeJob(id: string, status: Job['status']): Job {
  return {
    id,
    f: 10,
    c: 5,
    status,
    batchCount: 2,
    completedBatches: 0,
    resultPath: null,
    error: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: null,
    completedAt: null,
  };
}

describe('StatsCards', () => {
  it('shows correct worker stats when seeded', () => {
    useSystemStore.getState().setWorkers([
      { id: 'a', status: 'idle', currentTaskId: null },
      { id: 'b', status: 'busy', currentTaskId: 't1' },
    ]);
    useSystemStore.getState().setQueueDepth(7);
    useJobsStore.setState({
      jobs: {
        x: makeJob('x', 'done'),
        y: makeJob('y', 'running'),
      },
      jobTasks: {},
      expandedJobs: new Set(),
      queueDepthHistory: [],
    });

    render(<StatsCards />);

    // Workers total: 2 and Total Jobs: 2 both appear
    const twos = screen.getAllByText('2');
    expect(twos.length).toBe(2);
    // Idle: 1, Busy: 1, Done: 1 (all show value 1)
    const ones = screen.getAllByText('1');
    expect(ones.length).toBe(3);
    // Busy label
    expect(screen.getByText('Busy')).toBeInTheDocument();
    // Queue depth: 7
    expect(screen.getByText('7')).toBeInTheDocument();
    // Done label
    expect(screen.getByText('Jobs Done')).toBeInTheDocument();
    // Total label
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
  });

  it('shows zeros when stores are empty', () => {
    render(<StatsCards />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
  });
});
