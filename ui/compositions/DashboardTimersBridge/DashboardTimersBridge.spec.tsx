// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { DashboardTimersBridge } from './DashboardTimersBridge';
import { DASHBOARD_TIMER_STARTED_EVENT, DASHBOARD_TIMERS_CONNECTED_EVENT } from './dashboardTimerEvents';

const listeners = new Map<string, (event: Event) => void>();

class EventSourceMock {
  addEventListener(type: string, listener: (event: Event) => void) {
    listeners.set(type, listener);
  }

  close() {}
}

describe('DashboardTimersBridge', () => {
  beforeEach(() => {
    listeners.clear();
    vi.stubGlobal('EventSource', EventSourceMock as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('shows a neutral toast when a timer_started event arrives', () => {
    const timerStartedEventSpy = vi.fn();
    window.addEventListener(DASHBOARD_TIMER_STARTED_EVENT, timerStartedEventSpy as EventListener);

    render(
      <NotificationsProvider>
        <DashboardTimersBridge />
      </NotificationsProvider>,
    );

    act(() => {
      listeners.get('timer_started')?.(
        new MessageEvent('timer_started', {
          data: JSON.stringify({
            timer: {
              id: 'timer-1',
              durationSeconds: 600,
              createdAt: '2026-04-21T05:00:00.000Z',
              fireAt: '2026-04-21T05:10:00.000Z',
              removedAt: null,
              createdBy: {
                apiKeyId: null,
                apiKeyName: null,
              },
            },
            serverNow: '2026-04-21T05:00:00.000Z',
          }),
        }),
      );
    });

    expect(screen.getByText('Timer started').closest('[data-variant="neutral"]')).toBeInTheDocument();
    expect(screen.getByText('10m timer is now running.')).toBeInTheDocument();
    expect(timerStartedEventSpy).toHaveBeenCalledTimes(1);
  });

  test('dispatches a shared connected event and shows a warning toast when a timer expires locally', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T05:00:00.000Z'));
    const connectedEventSpy = vi.fn();
    window.addEventListener(DASHBOARD_TIMERS_CONNECTED_EVENT, connectedEventSpy as EventListener);

    render(
      <NotificationsProvider>
        <DashboardTimersBridge />
      </NotificationsProvider>,
    );

    act(() => {
      listeners.get('connected')?.(
        new MessageEvent('connected', {
          data: JSON.stringify({
            items: [
              {
                id: 'timer-1',
                durationSeconds: 600,
                createdAt: '2026-04-21T05:00:00.000Z',
                fireAt: '2026-04-21T05:10:00.000Z',
                removedAt: null,
                createdBy: {
                  apiKeyId: null,
                  apiKeyName: null,
                },
              },
            ],
            serverNow: '2026-04-21T05:00:00.000Z',
          }),
        }),
      );
    });

    expect(connectedEventSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(600_000);
    });

    expect(screen.getByText('Timer finished').closest('[data-variant="warning"]')).toBeInTheDocument();
    expect(screen.getByText('10m timer is complete.')).toBeInTheDocument();
  });

  test('does not show a local expiry notification after the timer is removed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T05:00:00.000Z'));

    render(
      <NotificationsProvider>
        <DashboardTimersBridge />
      </NotificationsProvider>,
    );

    act(() => {
      listeners.get('connected')?.(
        new MessageEvent('connected', {
          data: JSON.stringify({
            items: [
              {
                id: 'timer-1',
                durationSeconds: 600,
                createdAt: '2026-04-21T05:00:00.000Z',
                fireAt: '2026-04-21T05:10:00.000Z',
                removedAt: null,
                createdBy: {
                  apiKeyId: null,
                  apiKeyName: null,
                },
              },
            ],
            serverNow: '2026-04-21T05:00:00.000Z',
          }),
        }),
      );
    });

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    act(() => {
      listeners.get('timer_removed')?.(
        new MessageEvent('timer_removed', {
          data: JSON.stringify({
            timerId: 'timer-1',
            serverNow: '2026-04-21T05:05:00.000Z',
          }),
        }),
      );
    });

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(screen.queryByText('Timer finished')).not.toBeInTheDocument();
  });
});
