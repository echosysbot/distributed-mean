import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE } from '../hooks/useSSE';
import { useSystemStore } from '../store/useSystemStore';
import { useJobsStore } from '../store/useJobsStore';

// Fake EventSource class
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  dispatchMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  dispatchOpen() {
    if (this.onopen) {
      this.onopen();
    }
  }

  dispatchError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.useFakeTimers();
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useSSE', () => {
  it('handles queue_depth event and updates store', () => {
    const { unmount } = renderHook(() => useSSE());

    act(() => {
      const es = FakeEventSource.instances[0];
      expect(es).toBeDefined();
      es!.dispatchMessage({ type: 'queue_depth', depth: 9 });
    });

    expect(useSystemStore.getState().queueDepth).toBe(9);
    unmount();
  });

  it('handles worker_update event', () => {
    const { unmount } = renderHook(() => useSSE());

    act(() => {
      const es = FakeEventSource.instances[0];
      es!.dispatchMessage({
        type: 'worker_update',
        workers: [{ id: 'w1', status: 'idle', currentTaskId: null }],
      });
    });

    expect(useSystemStore.getState().workers).toHaveLength(1);
    expect(useSystemStore.getState().workers[0]?.id).toBe('w1');
    unmount();
  });

  it('sets connection status connected on open', () => {
    const { unmount } = renderHook(() => useSSE());

    act(() => {
      const es = FakeEventSource.instances[0];
      es!.dispatchOpen();
    });

    expect(useSystemStore.getState().connectionStatus).toBe('connected');
    unmount();
  });

  it('sets reconnecting status on error and schedules reconnect', () => {
    const { unmount } = renderHook(() => useSSE());

    act(() => {
      const es = FakeEventSource.instances[0];
      es!.dispatchError();
    });

    expect(useSystemStore.getState().connectionStatus).toBe('reconnecting');
    unmount();
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useSSE());

    const es = FakeEventSource.instances[0];
    expect(es).toBeDefined();

    unmount();

    expect(es!.closed).toBe(true);
  });

  it('ignores malformed JSON messages', () => {
    const { unmount } = renderHook(() => useSSE());

    act(() => {
      const es = FakeEventSource.instances[0];
      if (es!.onmessage) {
        es!.onmessage(new MessageEvent('message', { data: 'not-json' }));
      }
    });

    // Should not throw or change state
    expect(useSystemStore.getState().queueDepth).toBe(0);
    unmount();
  });

  it('reconnects after error timer fires', () => {
    const { unmount } = renderHook(() => useSSE());

    const firstInstance = FakeEventSource.instances[0];
    expect(firstInstance).toBeDefined();

    act(() => {
      firstInstance!.dispatchError();
    });

    expect(FakeEventSource.instances).toHaveLength(1);

    // Advance timers to trigger reconnect
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // A new EventSource should have been created
    expect(FakeEventSource.instances.length).toBeGreaterThan(1);
    unmount();
  });
});
