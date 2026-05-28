import { useState, type FormEvent } from 'react';
import { createJob, ApiError } from '../lib/api';
import { useJobsStore } from '../store/useJobsStore';
import { useLogStore } from '../store/useLogStore';
import { formatBytes, shortId } from '../lib/format';

interface Banner {
  type: 'success' | 'error';
  message: string;
}

export function SubmitJobForm() {
  const [f, setF] = useState(20);
  const [c, setC] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const sizeBytes = f * c * 9;
  const batches = Math.ceil(f / 5);

  function showBanner(b: Banner, durationMs = 6000) {
    setBanner(b);
    setTimeout(() => {
      setBanner(null);
    }, durationMs);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Client-side guard matching API Zod bounds (T-06-05)
    if (f < 2 || f > 100_000 || c < 1 || c > 10_000) {
      showBanner({ type: 'error', message: 'Invalid F or C — F must be 2..100000, C must be 1..10000' });
      return;
    }

    setSubmitting(true);
    try {
      const data = await createJob({ F: f, C: c });

      useJobsStore.getState().upsertJob({
        id: data.jobId,
        f: data.f,
        c: data.c,
        status: data.status,
        batchCount: data.batchCount,
        completedBatches: 0,
        createdAt: data.createdAt,
        resultPath: null,
        error: null,
        updatedAt: data.createdAt,
        completedAt: null,
      });

      useLogStore.getState().addLine('info', `Submitted job ${shortId(data.jobId)} (F=${f}, C=${c})`);
      showBanner({ type: 'success', message: `Job ${shortId(data.jobId)}… created — ${data.batchCount} batches` });
    } catch (err) {
      let message = 'Submission failed';
      if (err instanceof ApiError) {
        const body = err.body;
        if (body !== null && typeof body === 'object' && 'error' in body && typeof (body as Record<string, unknown>)['error'] === 'string') {
          message = (body as Record<string, string>)['error'] ?? 'Submission failed';
        } else {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = `Network error: ${err.message}`;
      }
      useLogStore.getState().addLine('error', message);
      showBanner({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 p-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Submit Job
      </h2>
      <form onSubmit={(e) => { void handleSubmit(e); }}>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label htmlFor="input-f" className="text-sm text-slate-400">Files (F)</label>
            <input
              id="input-f"
              type="number"
              value={f}
              min={2}
              max={100000}
              onChange={(e) => { setF(Number(e.target.value)); }}
              className="bg-slate-950 border border-slate-700 text-slate-100 px-3 py-2 rounded text-sm w-28 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="input-c" className="text-sm text-slate-400">Values / file (C)</label>
            <input
              id="input-c"
              type="number"
              value={c}
              min={1}
              max={10000}
              onChange={(e) => { setC(Number(e.target.value)); }}
              className="bg-slate-950 border border-slate-700 text-slate-100 px-3 py-2 rounded text-sm w-28 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-transparent select-none">&nbsp;</span>
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-5 py-2 rounded font-semibold text-sm"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          ~{formatBytes(sizeBytes)} total &middot; {batches} batch{batches === 1 ? '' : 'es'}
        </p>
        {banner !== null && (
          <div
            className={`mt-3 px-3 py-2 rounded text-sm border ${
              banner.type === 'success'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-red-950 text-red-300 border-red-800'
            }`}
          >
            {banner.message}
          </div>
        )}
      </form>
    </div>
  );
}
