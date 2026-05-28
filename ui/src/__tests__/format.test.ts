import { describe, it, expect } from 'vitest';
import { formatBytes, formatElapsed, shortId } from '../lib/format';

describe('formatBytes', () => {
  it('returns B for bytes under 1024', () => {
    expect(formatBytes(500)).toBe('500B');
  });

  it('returns KB for values between 1024 and 1MB', () => {
    expect(formatBytes(2048)).toContain('KB');
  });

  it('returns MB for values over 1MB', () => {
    expect(formatBytes(2_500_000)).toContain('MB');
  });

  it('handles 0 bytes', () => {
    expect(formatBytes(0)).toBe('0B');
  });

  it('handles exactly 1024 bytes as KB', () => {
    expect(formatBytes(1024)).toBe('1.0KB');
  });
});

describe('formatElapsed', () => {
  it('returns — when start is null', () => {
    expect(formatElapsed(null)).toBe('—');
  });

  it('returns — when start is undefined', () => {
    expect(formatElapsed(undefined)).toBe('—');
  });

  it('returns — when start is empty string', () => {
    expect(formatElapsed('')).toBe('—');
  });

  it('returns ms for sub-second elapsed', () => {
    const now = new Date().toISOString();
    const then = new Date(Date.now() + 800).toISOString();
    const result = formatElapsed(now, then);
    expect(result).toMatch(/ms$/);
  });

  it('returns seconds for sub-minute elapsed', () => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 5000).toISOString();
    expect(formatElapsed(start, end)).toMatch(/s$/);
  });

  it('returns Xm Ys for over 60s', () => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 125_000).toISOString();
    const result = formatElapsed(start, end);
    expect(result).toMatch(/m \d+s$/);
  });

  it('returns — for invalid start date', () => {
    expect(formatElapsed('not-a-date')).toBe('—');
  });
});

describe('shortId', () => {
  it('returns first 8 chars by default', () => {
    expect(shortId('abcdef12345')).toBe('abcdef12');
  });

  it('returns ? for null', () => {
    expect(shortId(null)).toBe('?');
  });

  it('returns ? for undefined', () => {
    expect(shortId(undefined)).toBe('?');
  });

  it('returns ? for empty string', () => {
    expect(shortId('')).toBe('?');
  });

  it('accepts optional length parameter', () => {
    expect(shortId('abcdefghij', 6)).toBe('abcdef');
  });
});
