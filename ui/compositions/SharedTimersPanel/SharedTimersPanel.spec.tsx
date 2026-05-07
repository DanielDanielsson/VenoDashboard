// @vitest-environment jsdom
import * as React from 'react';
import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DASHBOARD_TIMER_STARTED_EVENT } from '@ui/compositions/DashboardTimersBridge/dashboardTimerEvents';
import { SharedTimersPanel } from './SharedTimersPanel';

const useSWRMock = vi.fn();
const eventSourceSpy = vi.fn();

vi.mock('swr', () => ({
  __esModule: true,
  default: function useSWR(...args: unknown[]) {
    return useSWRMock(...args);
  },
}));

vi.mock('@ui/components/DashboardPanel', () => ({
  DashboardPanel: ({
    title,
    headerRight,
    children,
  }: {
    title: string;
    headerRight?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {headerRight}
      <div>{children}</div>
    </section>
  ),
}));

vi.mock('@ui/components/SecondaryButton', () => ({
  SecondaryButton: ({
    children,
    disabled,
  }: {
    children: ReactNode;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
}));

describe('SharedTimersPanel', () => {
  beforeEach(() => {
    useSWRMock.mockReset();
    eventSourceSpy.mockReset();
    useSWRMock.mockImplementation(() => {
      const [data, setData] = React.useState({
        items: [],
        serverNow: new Date().toISOString(),
      });

      return {
        data,
        error: undefined,
        mutate: async (updater: unknown) => {
          setData((current) =>
            typeof updater === 'function'
              ? (updater as (value: typeof current) => typeof current)(current)
              : (updater as typeof current),
          );
        },
      };
    });
    vi.stubGlobal(
      'EventSource',
      class {
        constructor() {
          eventSourceSpy();
        }
        addEventListener() {}
        close() {}
      } as unknown as typeof EventSource,
    );
  });

  test('does not fetch timers when rendered in read only mode', () => {
    render(<SharedTimersPanel readOnly />);

    expect(useSWRMock).toHaveBeenCalledWith(
      null,
      expect.any(Function),
      expect.objectContaining({ revalidateOnFocus: false }),
    );
    expect(
      screen.getByRole('button', { name: 'Admin sign in to start timers' }),
    ).toBeDisabled();
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
  });

  test('updates the rendered timer list from shared timer bridge events without opening its own stream', () => {
    render(<SharedTimersPanel />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(DASHBOARD_TIMER_STARTED_EVENT, {
          detail: {
            timer: {
              id: 'timer-1',
              durationSeconds: 600,
              createdAt: '2026-04-21T05:00:00.000Z',
              fireAt: '2099-04-21T05:10:00.000Z',
              removedAt: null,
              createdBy: {
                apiKeyId: null,
                apiKeyName: null,
              },
            },
            serverNow: '2026-04-21T05:00:00.000Z',
          },
        }),
      );
    });

    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(screen.getByText('10m')).toBeInTheDocument();
  });
});
