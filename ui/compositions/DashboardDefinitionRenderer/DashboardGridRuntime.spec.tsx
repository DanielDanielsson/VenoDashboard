// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { GridLayoutKind } from '@/lib/dashboard/schema';
import { DashboardGridPanel } from '@ui/compositions/DashboardGrid';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { DashboardGridRuntime } from './DashboardGridRuntime';

type MockLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const gridLayoutMock = vi.hoisted(() => ({
  mounted: true,
  width: 960,
  onLayoutChange: undefined as ((layout: MockLayoutItem[]) => void) | undefined,
}));

vi.mock('react-grid-layout', () => ({
  default: ({
    children,
    onLayoutChange,
  }: {
    children: ReactNode;
    layout: MockLayoutItem[];
    onLayoutChange?: (layout: MockLayoutItem[]) => void;
  }) => {
    gridLayoutMock.onLayoutChange = onLayoutChange;

    return (
      <section data-testid="dashboard-grid-layout">{children}</section>
    );
  },
  useContainerWidth: () => ({
    containerRef: { current: null },
    mounted: gridLayoutMock.mounted,
    width: gridLayoutMock.width,
  }),
  noCompactor: () => [],
}));

function createLayout(): GridLayoutKind {
  return {
    kind: 'GridLayout',
    spec: {
      items: [
        {
          kind: 'GridLayoutItem',
          spec: {
            x: 0,
            y: 0,
            width: 4,
            height: 6,
            element: {
              kind: 'ElementReference',
              name: 'panel-current-glucose',
            },
          },
        },
      ],
    },
  };
}

describe('DashboardGridRuntime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('saves changed admin dashboard state through the dashboard settings route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        dashboardSettings: {
          version: 4,
        },
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="statistics"
          dashboardVersion={3}
          initialPanelSettings={{
            'panel-current-glucose': { colorMode: 'threeColors' },
          }}
          layout={createLayout()}
          isOwner
          settingsRegistry={{
            'panel-current-glucose': {
              defaultSettings: { colorMode: 'threeColors' },
              render: ({ updateSettings }) => (
                <button
                  type="button"
                  onClick={() => {
                    updateSettings((current) => ({
                      ...(current as { colorMode: string }),
                      colorMode: 'gradient',
                    }));
                  }}
                >
                  Gradient
                </button>
              ),
            },
          }}
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));

    act(() => {
      gridLayoutMock.onLayoutChange?.([
        { i: 'panel-current-glucose', x: 2, y: 1, w: 5, h: 7 },
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Gradient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save dashboard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dashboard/settings/dashboards/statistics',
        expect.objectContaining({
          method: 'PUT',
        }),
      );
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({
      expectedVersion: 3,
      panelSettings: {
        'panel-current-glucose': { colorMode: 'gradient' },
      },
      layout: [
        {
          element: 'panel-current-glucose',
          x: 2,
          y: 1,
          width: 5,
          height: 7,
        },
      ],
    });

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getByText('Dashboard changes saved').closest('[data-variant="success"]')).toBeInTheDocument();
    expect(within(viewport).queryByText('Your latest layout and panel settings are now active.')).not.toBeInTheDocument();
  });

  test('saves changed dashboard time settings through the dashboard settings route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        dashboardSettings: {
          version: 4,
        },
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="statistics"
          dashboardVersion={3}
          layout={createLayout()}
          isOwner
          initialTimeSettings={{
            autoRefresh: '',
            autoRefreshIntervals: ['5s', '10s'],
          }}
          currentTimeSettings={{
            autoRefresh: '10s',
            autoRefreshIntervals: ['5s', '10s'],
          }}
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save dashboard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dashboard/settings/dashboards/statistics',
        expect.objectContaining({
          method: 'PUT',
        }),
      );
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({
      expectedVersion: 3,
      panelSettings: {},
      layout: [
        {
          element: 'panel-current-glucose',
          x: 0,
          y: 0,
          width: 4,
          height: 6,
        },
      ],
      timeSettings: {
        autoRefresh: '10s',
        autoRefreshIntervals: ['5s', '10s'],
      },
    });
  });

  test('shows an error toast when dashboard save fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: {
          message: 'Version conflict while saving dashboard',
        },
      }), { status: 409 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="statistics"
          dashboardVersion={3}
          layout={createLayout()}
          isOwner
          initialTimeSettings={{
            autoRefresh: '',
            autoRefreshIntervals: ['5s', '10s'],
          }}
          currentTimeSettings={{
            autoRefresh: '10s',
            autoRefreshIntervals: ['5s', '10s'],
          }}
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save dashboard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getByText('Dashboard changes could not be saved').closest('[data-variant="error"]')).toBeInTheDocument();
    expect(within(viewport).getByText('Version conflict while saving dashboard')).toBeInTheDocument();
  });

  test('shows an admin access error toast when a public user tries to save dashboard changes', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="statistics"
          dashboardVersion={3}
          initialPanelSettings={{
            'panel-current-glucose': { colorMode: 'threeColors' },
          }}
          layout={createLayout()}
          isOwner={false}
          settingsRegistry={{
            'panel-current-glucose': {
              defaultSettings: { colorMode: 'threeColors' },
              render: ({ updateSettings }) => (
                <button
                  type="button"
                  onClick={() => {
                    updateSettings((current) => ({
                      ...(current as { colorMode: string }),
                      colorMode: 'gradient',
                    }));
                  }}
                >
                  Gradient
                </button>
              ),
            },
          }}
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Gradient' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));

    expect(fetchMock).not.toHaveBeenCalled();

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getByText('Admin sign in required').closest('[data-variant="error"]')).toBeInTheDocument();
    expect(within(viewport).getByText('Sign in with admin access before saving dashboard changes.')).toBeInTheDocument();
  });
});
