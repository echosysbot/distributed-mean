import { describe, it, expect, beforeEach } from 'vitest';
import { useLogStore } from '../store/useLogStore';
import { useJobsStore } from '../store/useJobsStore';
import { useSystemStore } from '../store/useSystemStore';

beforeEach(() => {
  useLogStore.setState({ lines: [], filter: 'all' });
  useJobsStore.setState({
    jobs: {},
    jobTasks: {},
    expandedJobs: new Set(),
    queueDepthHistory: [],
  });
  useSystemStore.setState({
    workers: [],
    queueDepth: 0,
    connectionStatus: 'connecting',
    workerSpeedHistory: {},
  });
});

describe('useLogStore', () => {
  it('addLine adds a line to store', () => {
    useLogStore.getState().addLine('info', 'hello');
    expect(useLogStore.getState().lines).toHaveLength(1);
    expect(useLogStore.getState().lines[0]?.message).toBe('hello');
  });

  it('caps to 200 lines when over limit', () => {
    for (let i = 0; i < 205; i++) {
      useLogStore.getState().addLine('info', `line ${i.toString()}`);
    }
    expect(useLogStore.getState().lines).toHaveLength(200);
  });

  it('setFilter changes the filter', () => {
    useLogStore.getState().setFilter('error');
    expect(useLogStore.getState().filter).toBe('error');
  });

  it('clear removes all lines', () => {
    useLogStore.getState().addLine('info', 'test');
    useLogStore.getState().clear();
    expect(useLogStore.getState().lines).toHaveLength(0);
  });
});

describe('useJobsStore', () => {
  it('upsertJob merges a new job', () => {
    useJobsStore.getState().upsertJob({
      id: 'j1',
      f: 10,
      c: 5,
      status: 'queued',
      batchCount: 2,
      completedBatches: 0,
      resultPath: null,
      error: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: null,
      completedAt: null,
    });
    expect(useJobsStore.getState().jobs['j1']).toBeDefined();
    expect(useJobsStore.getState().jobs['j1']?.f).toBe(10);
  });

  it('upsertJob with same id partial update preserves other fields', () => {
    useJobsStore.getState().upsertJob({
      id: 'j2',
      f: 20,
      c: 100,
      status: 'queued',
      batchCount: 4,
      completedBatches: 0,
      resultPath: null,
      error: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: null,
      completedAt: null,
    });
    useJobsStore.getState().upsertJob({ id: 'j2', status: 'running' });
    const job = useJobsStore.getState().jobs['j2'];
    expect(job?.status).toBe('running');
    expect(job?.f).toBe(20); // preserved
    expect(job?.c).toBe(100); // preserved
  });

  it('toggleExpanded adds job to expandedJobs set', () => {
    useJobsStore.getState().toggleExpanded('j3');
    expect(useJobsStore.getState().expandedJobs.has('j3')).toBe(true);
  });

  it('toggleExpanded removes job from expandedJobs set when already expanded', () => {
    useJobsStore.getState().toggleExpanded('j3');
    useJobsStore.getState().toggleExpanded('j3');
    expect(useJobsStore.getState().expandedJobs.has('j3')).toBe(false);
  });
});

describe('useSystemStore', () => {
  it('setWorkers updates workers list', () => {
    const workers = [
      { id: 'w1', status: 'idle' as const, currentTaskId: null },
      { id: 'w2', status: 'busy' as const, currentTaskId: 't1' },
    ];
    useSystemStore.getState().setWorkers(workers);
    expect(useSystemStore.getState().workers).toHaveLength(2);
  });

  it('setWorkers appends to workerSpeedHistory', () => {
    const workers = [{ id: 'w1', status: 'idle' as const, currentTaskId: null }];
    useSystemStore.getState().setWorkers(workers);
    const history = useSystemStore.getState().workerSpeedHistory['w1'];
    expect(history).toBeDefined();
    expect(history!.length).toBeGreaterThan(0);
  });

  it('setQueueDepth updates queueDepth', () => {
    useSystemStore.getState().setQueueDepth(7);
    expect(useSystemStore.getState().queueDepth).toBe(7);
  });

  it('setConnectionStatus updates connectionStatus', () => {
    useSystemStore.getState().setConnectionStatus('connected');
    expect(useSystemStore.getState().connectionStatus).toBe('connected');
  });
});
