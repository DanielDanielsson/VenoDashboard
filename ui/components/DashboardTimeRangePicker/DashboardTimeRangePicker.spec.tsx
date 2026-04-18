// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DashboardTimeRangePicker } from './DashboardTimeRangePicker';

describe('DashboardTimeRangePicker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('applies a quick range', () => {
    const onChange = vi.fn();

    render(
      <DashboardTimeRangePicker
        selection={{ kind: 'preset', range: '3d' }}
        currentWindow={{
          from: '2026-04-14T08:00:00.000Z',
          to: '2026-04-17T08:00:00.000Z'
        }}
        timeZone="UTC"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Time range selected/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 minutes' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'custom',
      raw: { from: 'now-30m', to: 'now' },
      label: 'Last 30 minutes'
    }));
  });

  test('disables quick ranges above the safety cap', () => {
    render(
      <DashboardTimeRangePicker
        selection={{ kind: 'preset', range: '3d' }}
        currentWindow={{
          from: '2026-04-14T08:00:00.000Z',
          to: '2026-04-17T08:00:00.000Z'
        }}
        timeZone="UTC"
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Time range selected/i }));

    expect(screen.getByRole('button', { name: /Last 1 year/i })).toBeDisabled();
  });

  test('disables moving forward when the next window would end in the future', () => {
    const onChange = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T08:30:00.000Z'));

    render(
      <DashboardTimeRangePicker
        selection={{ kind: 'custom', window: {
          from: '2026-04-17T07:00:00.000Z',
          to: '2026-04-17T08:00:00.000Z'
        } }}
        currentWindow={{
          from: '2026-04-17T07:00:00.000Z',
          to: '2026-04-17T08:00:00.000Z'
        }}
        timeZone="UTC"
        onChange={onChange}
      />
    );

    const forwardButton = screen.getByRole('button', { name: 'Move time range forwards' });
    expect(forwardButton).toBeDisabled();

    fireEvent.click(forwardButton);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('allows moving forward when the next window ends at now', () => {
    const onChange = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T09:00:00.000Z'));

    render(
      <DashboardTimeRangePicker
        selection={{ kind: 'custom', window: {
          from: '2026-04-17T07:00:00.000Z',
          to: '2026-04-17T08:00:00.000Z'
        } }}
        currentWindow={{
          from: '2026-04-17T07:00:00.000Z',
          to: '2026-04-17T08:00:00.000Z'
        }}
        timeZone="UTC"
        onChange={onChange}
      />
    );

    const forwardButton = screen.getByRole('button', { name: 'Move time range forwards' });
    expect(forwardButton).toBeEnabled();

    fireEvent.click(forwardButton);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'custom',
      window: {
        from: '2026-04-17T08:00:00.000Z',
        to: '2026-04-17T09:00:00.000Z'
      }
    }));
  });
});
