import React from 'react';
import { useSSE } from './src/hooks/useSSE';
import { useInitialLoad } from './src/hooks/useInitialLoad';
import { useSystemStore } from './src/store/useSystemStore';

function AppPlaceholder(): React.ReactElement {
  useSSE();
  useInitialLoad();
  const connectionStatus = useSystemStore((s) => s.connectionStatus);

  return (
    <div className="p-4 text-slate-200">
      <h1 className="text-xl font-bold mb-2">Distributed Mean — Dashboard</h1>
      <span className="text-sm text-slate-400">
        Connection: <span className="font-mono">{connectionStatus}</span>
      </span>
    </div>
  );
}

export default AppPlaceholder;
