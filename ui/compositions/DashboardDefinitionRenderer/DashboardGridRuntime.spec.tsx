// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { GridLayoutKind, PanelKind } from '@/lib/dashboard/schema';
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
const pushMock = vi.fn();

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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
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

function createTwoPanelLayout(): GridLayoutKind {
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
        {
          kind: 'GridLayoutItem',
          spec: {
            x: 4,
            y: 0,
            width: 8,
            height: 6,
            element: {
              kind: 'ElementReference',
              name: 'panel-connections',
            },
          },
        },
      ],
    },
  };
}

function createPanel(group: string, title: string): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      id: 1,
      title,
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: [],
          transformations: [],
          queryOptions: {},
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group,
        version: 'v1',
        spec: {
          options: {},
          fieldConfig: {
            defaults: {},
            overrides: [],
          },
        },
      },
    },
  };
}

describe('DashboardGridRuntime', () => {
  afterEach(() => {
    vi.useRealTimers();
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
            'panel-current-glucose': { colorMode: 'standard' },
          }}
          initialElements={{
            'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
          }}
          layout={createLayout()}
          isOwner
          settingsRegistry={{
            'veno.live-glucose': {
              defaultSettings: { colorMode: 'standard' },
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

  test('recovers when the dashboard settings save request times out', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="statistics"
          dashboardVersion={3}
          layout={createLayout()}
          isOwner
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

    fireEvent.click(screen.getByRole('button', { name: 'Save dashboard' }));
    expect(screen.getByRole('button', { name: 'Save dashboard' })).toHaveTextContent('Saving');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    vi.useRealTimers();

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: 'Save dashboard' });
      expect(saveButton).toHaveTextContent('Save');
      expect(saveButton).not.toBeDisabled();
    });

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getByText('Saving dashboard settings timed out. Try again.')).toBeInTheDocument();
  });

  test('shows available compatible panels in the add panel drawer', async () => {
    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="overview"
          dashboardType="live"
          layout={createLayout()}
          initialElements={{
            'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
          }}
          isOwner
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add panel' }));

    const drawer = screen.getByRole('complementary', { name: 'Add panel' });

    expect(within(drawer).queryByRole('button', { name: 'Current Glucose' })).not.toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Connections' })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Timers' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Time in Range' })).not.toBeInTheDocument();
  });

  test('shows live panel options for an empty live dashboard', async () => {
    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="night-view"
          dashboardType="live"
          layout={{
            kind: 'GridLayout',
            spec: {
              items: [],
            },
          }}
          initialElements={{}}
          isOwner
          renderPanel={(panelId, panel) => (
            <DashboardGridPanel key={panelId} panelId={panelId} title={panel.spec.title}>
              {panel.spec.title} panel
            </DashboardGridPanel>
          )}
        >
          {null}
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add panel' }));

    const drawer = screen.getByRole('complementary', { name: 'Add panel' });

    expect(within(drawer).getByRole('button', { name: 'Current Glucose' })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Connections' })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Timers' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Time in Range' })).not.toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Current Glucose' }));

    expect(screen.getByText('Current Glucose panel')).toBeInTheDocument();
  });

  test('inserts a selected panel as a draft and saves its definition with the layout', async () => {
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
          dashboardUid="overview"
          dashboardType="live"
          dashboardVersion={3}
          layout={createLayout()}
          initialElements={{
            'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
          }}
          isOwner
          renderPanel={(panelId, panel) => (
            <DashboardGridPanel key={panelId} panelId={panelId} title={panel.spec.title}>
              {panel.spec.title} panel
            </DashboardGridPanel>
          )}
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add panel' }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Add panel' })).getByRole('button', { name: 'Connections' }));

    expect(screen.getByText('Connections panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save dashboard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      expectedVersion: 3,
      elements: {
        'panel-current-glucose': {
          spec: {
            vizConfig: {
              group: 'veno.live-glucose',
            },
          },
        },
        'panel-connections': {
          spec: {
            title: 'Connections',
            vizConfig: {
              group: 'veno.connections-map',
            },
          },
        },
      },
      layout: [
        {
          element: 'panel-current-glucose',
          x: 0,
          y: 0,
          width: 4,
          height: 6,
        },
        {
          element: 'panel-connections',
          x: 0,
          y: 6,
        },
      ],
    });
  });

  test('discarding changes removes draft added panels', async () => {
    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="overview"
          dashboardType="live"
          dashboardVersion={3}
          layout={createLayout()}
          initialElements={{
            'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
          }}
          isOwner
          renderPanel={(panelId, panel) => (
            <DashboardGridPanel key={panelId} panelId={panelId} title={panel.spec.title}>
              {panel.spec.title} panel
            </DashboardGridPanel>
          )}
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add panel' }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Add panel' })).getByRole('button', { name: 'Connections' }));

    expect(screen.getByText('Connections panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exit dashboard edit mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(screen.queryByText('Connections panel')).not.toBeInTheDocument();
  });

  test('removes a panel as an admin draft and saves the remaining definition', async () => {
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
          dashboardUid="overview"
          dashboardType="live"
          dashboardVersion={3}
          layout={createTwoPanelLayout()}
          initialElements={{
            'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
            'panel-connections': createPanel('veno.connections-map', 'Connections'),
          }}
          isOwner
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
          <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
            Connections panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));

    expect(screen.queryByText('Current glucose panel')).not.toBeInTheDocument();
    expect(screen.getByText('Connections panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save dashboard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      expectedVersion: 3,
      elements: {
        'panel-connections': {
          spec: {
            vizConfig: {
              group: 'veno.connections-map',
            },
          },
        },
      },
      layout: [
        {
          element: 'panel-connections',
          x: 4,
          y: 0,
          width: 8,
          height: 6,
        },
      ],
    });
    expect(JSON.parse(String(requestInit.body)).elements).not.toHaveProperty('panel-current-glucose');
  });

  test('discarding changes restores removed panels', async () => {
    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="overview"
          dashboardType="live"
          dashboardVersion={3}
          layout={createTwoPanelLayout()}
          initialElements={{
            'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
            'panel-connections': createPanel('veno.connections-map', 'Connections'),
          }}
          isOwner
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
          <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
            Connections panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));

    expect(screen.queryByText('Current glucose panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exit dashboard edit mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
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
    expect(screen.getByTestId('dashboard-grid-layout').parentElement?.parentElement).not.toHaveTextContent(
      'Version conflict while saving dashboard',
    );
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
            'panel-current-glucose': { colorMode: 'standard' },
          }}
          initialElements={{
            'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
          }}
          layout={createLayout()}
          isOwner={false}
          settingsRegistry={{
            'veno.live-glucose': {
              defaultSettings: { colorMode: 'standard' },
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

    expect(screen.queryByRole('button', { name: 'Add panel' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));

    expect(screen.queryByRole('menuitem', { name: 'Remove' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Gradient' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));

    expect(fetchMock).not.toHaveBeenCalled();

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getByText('Admin sign in required').closest('[data-variant="error"]')).toBeInTheDocument();
    expect(within(viewport).getByText('Sign in with admin access before saving dashboard changes.')).toBeInTheDocument();
  });

  test('deletes a custom dashboard from the edit toolbar only after edit mode is active', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        dashboardUid: 'training-review',
        preferences: {
          homeDashboardUid: 'overview',
          pinnedDashboardUids: [],
        },
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardGridRuntime
          dashboardUid="training-review"
          dashboardVersion={3}
          layout={createLayout()}
          isOwner
          allowDashboardDelete
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGridRuntime>
      </NotificationsProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Delete dashboard' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete dashboard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/dashboards/training-review', expect.objectContaining({
        method: 'DELETE',
      }));
    });
    expect(pushMock).toHaveBeenCalledWith('/dashboards');
    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getByText('Dashboard deleted').closest('[data-variant="success"]')).toBeInTheDocument();
  });
});
