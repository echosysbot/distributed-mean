import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogFeed } from '../components/LogFeed';
import { useLogStore } from '../store/useLogStore';

beforeEach(() => {
  useLogStore.setState({ lines: [], filter: 'all' });
});

describe('LogFeed', () => {
  it('renders log messages', () => {
    useLogStore.getState().addLine('info', 'hello');
    useLogStore.getState().addLine('warn', 'warn-msg');
    render(<LogFeed />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('warn-msg')).toBeInTheDocument();
  });

  it('clicking Error filter hides info/warn messages', async () => {
    const user = userEvent.setup();
    useLogStore.getState().addLine('info', 'info-message');
    useLogStore.getState().addLine('warn', 'warn-message');
    render(<LogFeed />);

    await user.click(screen.getByText('error'));

    expect(screen.queryByText('info-message')).not.toBeInTheDocument();
    expect(screen.queryByText('warn-message')).not.toBeInTheDocument();
  });

  it('clicking Clear removes all messages', async () => {
    const user = userEvent.setup();
    useLogStore.getState().addLine('info', 'some-log-line');
    render(<LogFeed />);

    await user.click(screen.getByText('Clear'));

    expect(screen.queryByText('some-log-line')).not.toBeInTheDocument();
  });

  it('filter buttons exist for all levels', () => {
    render(<LogFeed />);
    expect(screen.getByText('all')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText('warn')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('renders empty log area when no lines', () => {
    render(<LogFeed />);
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
  });
});
