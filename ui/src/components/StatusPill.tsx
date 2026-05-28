import { useSystemStore } from '../store/useSystemStore';

const dotColors: Record<string, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-slate-500',
  reconnecting: 'bg-amber-500',
};

const labelText: Record<string, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
};

export function StatusPill() {
  const connectionStatus = useSystemStore((s) => s.connectionStatus);

  const dotClass = dotColors[connectionStatus] ?? 'bg-slate-500';
  const label = labelText[connectionStatus] ?? connectionStatus;

  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotClass}`} />
      <span className="text-sm text-slate-400">{label}</span>
    </span>
  );
}
