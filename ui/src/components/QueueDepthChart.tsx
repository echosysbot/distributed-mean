import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useJobsStore } from '../store/useJobsStore';

const WINDOW_MS = 120_000; // 2 minutes

interface ChartPoint {
  t: number;
  ts: string;
  depth: number;
}

export function QueueDepthChart() {
  const queueDepthHistory = useJobsStore((s) => s.queueDepthHistory);
  // Force re-render every 2s to preserve the rolling-window visual (T-06-07)
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1);
    }, 2000);
    return () => { clearInterval(id); };
  }, []);

  const now = Date.now();
  const data: ChartPoint[] = queueDepthHistory
    .filter((s) => s.t >= now - WINDOW_MS)
    .map((s) => ({
      t: s.t,
      ts: new Date(s.t).toLocaleTimeString(),
      depth: s.depth,
    }));

  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 p-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Queue Depth (last 2 min)
      </h2>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="ts" tick={{ fontSize: 10, fill: '#64748b' }} hide />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Line
            type="monotone"
            dataKey="depth"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
