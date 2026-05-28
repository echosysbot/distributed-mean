import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/StatusBadge';

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="queued" />);
    expect(screen.getByText('queued')).toBeInTheDocument();
  });

  it('renders running status for job', () => {
    render(<StatusBadge status="running" kind="job" />);
    const badge = screen.getByText('running');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('emerald');
  });

  it('renders done status', () => {
    render(<StatusBadge status="done" />);
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('renders failed status', () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('renders task status badge', () => {
    render(<StatusBadge status="pending" kind="task" />);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders generating status', () => {
    render(<StatusBadge status="generating" />);
    expect(screen.getByText('generating')).toBeInTheDocument();
  });
});
