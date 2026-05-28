import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark slate palette matching reference dashboard
        'bg-primary': '#0f172a',   // slate-900
        'bg-card': '#1e293b',      // slate-800
        'bg-border': '#334155',    // slate-700
        'text-primary': '#f1f5f9', // slate-100
        'text-secondary': '#94a3b8', // slate-400
        'text-muted': '#64748b',   // slate-500
        'accent-indigo': '#6366f1', // indigo-500
        'accent-green': '#22c55e', // emerald-500
        'accent-amber': '#f59e0b', // amber-500
        'accent-red': '#ef4444',   // red-500
      },
    },
  },
  plugins: [],
};

export default config;
