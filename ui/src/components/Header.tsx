import { StatusPill } from './StatusPill';

export function Header() {
  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center">
      <h1 className="text-2xl font-bold text-slate-100">⚡ Distributed Mean</h1>
      <div className="ml-auto">
        <StatusPill />
      </div>
    </header>
  );
}
