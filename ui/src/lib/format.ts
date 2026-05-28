/** Returns a human-readable byte string (B / KB / MB). */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Returns a human-readable elapsed time string.
 * Returns '—' if start is null/undefined.
 */
export function formatElapsed(start: string | null, end?: string | null): string {
  if (!start) return '—';
  const startMs = new Date(start).getTime();
  const endMs = end != null ? new Date(end).getTime() : Date.now();
  const ms = endMs - startMs;
  if (ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/** Returns the first `len` characters of a string. */
export function shortId(id: string, len = 8): string {
  return id.slice(0, len);
}

/** Returns a localized HH:MM:SS time string. */
export function formatTime(iso: string | number): string {
  return new Date(iso).toLocaleTimeString();
}
