import { useInitialLoad } from './hooks/useInitialLoad';
import { useSSE } from './hooks/useSSE';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { WorkerFleet } from './components/WorkerFleet';
import { SubmitJobForm } from './components/SubmitJobForm';
import { QueueDepthChart } from './components/QueueDepthChart';
import { WorkerSpeedChart } from './components/WorkerSpeedChart';
import { JobsTable } from './components/JobsTable';
import { LogFeed } from './components/LogFeed';

export default function App() {
  useInitialLoad();
  useSSE();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <Header />
      <main className="max-w-7xl mx-auto p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="lg:col-span-2">
          <StatsCards />
        </div>

        <section className="rounded-lg bg-slate-800 border border-slate-700 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Worker Fleet
          </h2>
          <WorkerFleet />
        </section>

        <section className="rounded-lg bg-slate-800 border border-slate-700 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Submit Job
          </h2>
          <SubmitJobForm />
        </section>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
          <section className="rounded-lg bg-slate-800 border border-slate-700 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Queue Depth
            </h2>
            <QueueDepthChart />
          </section>
          <section className="rounded-lg bg-slate-800 border border-slate-700 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Worker Activity
            </h2>
            <WorkerSpeedChart />
          </section>
        </div>

        <section className="lg:col-span-2 rounded-lg bg-slate-800 border border-slate-700 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Jobs
          </h2>
          <JobsTable />
        </section>

        <section className="lg:col-span-2 rounded-lg bg-slate-800 border border-slate-700 p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Live Log
            </h2>
          </div>
          <LogFeed />
        </section>
      </main>
    </div>
  );
}
