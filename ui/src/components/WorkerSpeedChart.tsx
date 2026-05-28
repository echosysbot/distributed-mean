import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { useSystemStore } from '../store/useSystemStore';
import { shortId } from '../lib/format';

const WINDOW_MS = 120_000; // 2 minutes
const BUCKET_MS = 5_000; // 5-second buckets
const NUM_BUCKETS = WINDOW_MS / BUCKET_MS; // 24

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#8b5cf6'];

function workerColor(workerId: string): string {
  let hash = 0;
  for (let i = 0; i < workerId.length; i++) {
    hash = (hash * 31 + workerId.charCodeAt(i)) & 0xffff;
  }
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0] ?? '#6366f1';
}

interface BucketRow {
  ts: string;
  [workerId: string]: number | string;
}

export function WorkerSpeedChart() {
  const workerSpeedHistory = useSystemStore((s) => s.workerSpeedHistory);
  // Force re-render every 2s to preserve the rolling-window visual (T-06-07)
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1);
    }, 2000);
    return () => { clearInterval(id); };
  }, []);

  const workerIds = Object.keys(workerSpeedHistory);

  if (workerIds.length === 0) {
    return (
      <div className="rounded-lg bg-slate-800 border border-slate-700 p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Worker Activity (last 2 min)
        </h2>
        <p className="text-slate-500 text-sm">No worker activity yet</p>
      </div>
    );
  }

  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Build NUM_BUCKETS bucket end-times
  const bucketEnds: number[] = [];
  for (let i = 1; i <= NUM_BUCKETS; i++) {
    bucketEnds.push(windowStart + i * BUCKET_MS);
  }

  // Build unified data array
  const data: BucketRow[] = bucketEnds.map((bucketEnd) => {
    const bucketStart = bucketEnd - BUCKET_MS;
    const row: BucketRow = { ts: new Date(bucketEnd).toLocaleTimeString() };

    for (const wid of workerIds) {
      const samples = workerSpeedHistory[wid] ?? [];
      const inBucket = samples.filter((s) => s.t >= bucketStart && s.t < bucketEnd);
      const ratio = inBucket.length === 0 ? 0 : inBucket.filter((s) => s.busy).length / inBucket.length;
      row[wid] = Math.round(ratio * 100) / 100;
    }

    return row;
  });

  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 p-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Worker Activity (last 2 min)
      </h2>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="ts" tick={{ fontSize: 10, fill: '#64748b' }} hide />
          <YAxis
            allowDecimals={true}
            domain={[0, 1]}
            tick={{ fontSize: 10, fill: '#64748b' }}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '10px', color: '#64748b' }}
            formatter={(value: string) => shortId(value, 8)}
          />
          {workerIds.map((wid) => (
            <Line
              key={wid}
              type="monotone"
              dataKey={wid}
              name={wid}
              stroke={workerColor(wid)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
