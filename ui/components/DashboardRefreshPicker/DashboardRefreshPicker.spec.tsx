// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DashboardRefreshPicker } from './DashboardRefreshPicker';

const currentWindow = {
  from: '2026-04-19T09:00:00.000Z',
  to: '2026-04-19T12:00:00.000Z',
};

const setDocumentHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  });
};

describe('DashboardRefreshPicker', () => {
  afterEach(() => {
    vi.useRealTimers();
    setDocumentHidden(false);
  });

  test('runs a manual dashboard refresh', () => {
    const onRefresh = vi.fn();

    render(
      <DashboardRefreshPicker
        value=""
        intervals={['5s', '10s']}
        currentWindow={currentWindow}
        onChange={vi.fn()}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('emits refresh interval changes', () => {
    const onChange = vi.fn();

    render(
      <DashboardRefreshPicker
        value=""
        intervals={['5s', '10s']}
        currentWindow={currentWindow}
        onChange={onChange}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Dashboard refresh interval'), {
      target: { value: '10s' },
    });

    expect(screen.getByLabelText('Dashboard refresh interval')).toHaveClass('cursor-pointer');
    expect(onChange).toHaveBeenCalledWith('10s');
  });

  test('does not start a timer when auto refresh is off', () => {
    const onRefresh = vi.fn();
    vi.useFakeTimers();

    render(
      <DashboardRefreshPicker
        value=""
        intervals={['5s', '10s']}
        currentWindow={currentWindow}
        onChange={vi.fn()}
        onRefresh={onRefresh}
      />,
    );

    vi.advanceTimersByTime(30_000);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  test('refreshes on the selected interval', async () => {
    const onRefresh = vi.fn();
    vi.useFakeTimers();

    render(
      <DashboardRefreshPicker
        value="5s"
        intervals={['5s', '10s']}
        currentWindow={currentWindow}
        onChange={vi.fn()}
        onRefresh={onRefresh}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('queues one refresh while the document is hidden', async () => {
    const onRefresh = vi.fn();
    vi.useFakeTimers();
    setDocumentHidden(true);

    render(
      <DashboardRefreshPicker
        value="5s"
        intervals={['5s', '10s']}
        currentWindow={currentWindow}
        onChange={vi.fn()}
        onRefresh={onRefresh}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(onRefresh).not.toHaveBeenCalled();

    setDocumentHidden(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
