import { useEffect, useRef, useState } from 'react';
import { useJobsStore } from '../store/useJobsStore';
import { useLogStore } from '../store/useLogStore';
import { getJobTasks } from '../lib/api';
import { shortId } from '../lib/format';

interface UseJobTasksResult {
  loading: boolean;
  error: string | null;
}

/**
 * Lazy-loads tasks for a job when `enabled` becomes true.
 * Results are cached into useJobsStore via setJobTasks — deduplicated
 * by store-cached check and an in-flight ref (mitigates T-06-08).
 */
export function useJobTasks(jobId: string, enabled: boolean): UseJobTasksResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Already cached — nothing to do
    const cached = useJobsStore.getState().jobTasks[jobId];
    if (cached !== undefined) return;

    // Deduplicate concurrent fetches for the same job
    if (inFlight.current) return;

    const controller = new AbortController();
    inFlight.current = true;
    setLoading(true);
    setError(null);

    getJobTasks(jobId, controller.signal)
      .then((tasks) => {
        if (!controller.signal.aborted) {
          useJobsStore.getState().setJobTasks(jobId, tasks);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setLoading(false);
        useLogStore
          .getState()
          .addLine('warn', `Failed to load tasks for ${shortId(jobId)}: ${message}`);
      })
      .finally(() => {
        inFlight.current = false;
      });

    return () => { controller.abort(); };
  }, [jobId, enabled]);

  return { loading, error };
}
