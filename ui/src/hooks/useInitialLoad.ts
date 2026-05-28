import { useEffect } from 'react';
import { listJobs, getSystem } from '../lib/api';
import { useJobsStore } from '../store/useJobsStore';
import { useSystemStore } from '../store/useSystemStore';
import { useLogStore } from '../store/useLogStore';

export function useInitialLoad(): void {
  useEffect(() => {
    void (async () => {
      try {
        const [jobs, sys] = await Promise.all([listJobs(), getSystem()]);
        useJobsStore.setState({
          jobs: Object.fromEntries(jobs.map((j) => [j.id, j])),
        });
        useSystemStore.setState({
          workers: sys.workers,
          queueDepth: sys.queueDepth,
          // connectionStatus is owned exclusively by useSSE — do not write here
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        useLogStore.getState().addLine('warn', `Initial load failed: ${message}`);
      }
    })();
  }, []);
}
