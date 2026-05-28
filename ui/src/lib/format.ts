/**
 * Formatting utilities shared across components.
 * Mirrors the legacy vanilla dashboard helpers (legacy.index.html lines 468–475, 548–552).
 */

/** Returns a short 8-character prefix of a UUID for display. */
export function shortId(id: string | null | undefined): string {
  if (id == null || id.length === 0) return '?';
  return id.substring(0, 8);
}

/**
 * Format elapsed time between two ISO timestamp strings.
 * If `end` is null, computes elapsed up to now (for running tasks).
 * Returns '—' when start is null/falsy.
 */
export function formatElapsed(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (start == null || start === '') return '—';
  const startMs = new Date(start).getTime();
  if (isNaN(startMs)) return '—';
  const endMs = end != null && end !== '' ? new Date(end).getTime() : Date.now();
  const ms = endMs - startMs;
  if (ms < 0) return '—';
  if (ms < 1000) return `${ms.toString()}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000).toString()}m ${Math.floor((ms % 60_000) / 1000).toString()}s`;
}

/**
 * Format a byte count as a human-readable string.
 * Used in the submit job form size hint.
 */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b.toString()}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}
