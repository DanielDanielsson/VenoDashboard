// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { GridLayoutKind } from '@/lib/dashboard/schema';
import { DashboardGrid, DashboardGridPanel } from '@ui/compositions/DashboardGrid';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { DashboardViewPanelUrlStateBridge } from './DashboardViewPanelUrlStateBridge';

const usePathnameMock = vi.fn();
const useSearchParamsMock = vi.fn();

const gridLayoutMock = vi.hoisted(() => ({
  mounted: true,
  width: 960,
  layout: [] as Array<{ i: string; x: number; y: number; w: number; h: number }>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock('react-grid-layout', () => ({
  default: ({
    children,
    layout,
  }: {
    children: ReactNode;
    layout: Array<{ i: string; x: number; y: number; w: number; h: number }>;
  }) => {
    gridLayoutMock.layout = layout;
    return <section data-testid="dashboard-grid-layout">{children}</section>;
  },
  useContainerWidth: () => ({
    containerRef: { current: null },
    measureWidth: vi.fn(),
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
        {
          kind: 'GridLayoutItem',
          spec: {
            x: 0,
            y: 6,
            width: 12,
            height: 8,
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

describe('DashboardViewPanelUrlStateBridge', () => {
  test('opens the requested solo panel from a public viewPanel link', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams('viewPanel=panel-current-glucose'));

    render(
      <NotificationsProvider>
        <DashboardViewPanelUrlStateBridge
          dashboardUid="night-view"
          allowedPanelIds={['panel-current-glucose', 'panel-connections']}
        >
          {({ viewedPanelId, onViewedPanelChange }) => (
            <DashboardGrid
              layout={createLayout()}
              viewedPanelId={viewedPanelId}
              onViewedPanelChange={onViewedPanelChange}
            >
              <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
                Current glucose panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
                Connections panel
              </DashboardGridPanel>
            </DashboardGrid>
          )}
        </DashboardViewPanelUrlStateBridge>
      </NotificationsProvider>,
    );

    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.queryByText('Connections panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'to dashboard' })).toBeInTheDocument();
    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 12, h: 14 },
    ]);
  });

  test('pushes viewPanel into the url when panel view is opened from the menu', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    render(
      <NotificationsProvider>
        <DashboardViewPanelUrlStateBridge
          dashboardUid="night-view"
          allowedPanelIds={['panel-current-glucose', 'panel-connections']}
        >
          {({ viewedPanelId, onViewedPanelChange }) => (
            <DashboardGrid
              layout={createLayout()}
              viewedPanelId={viewedPanelId}
              onViewedPanelChange={onViewedPanelChange}
            >
              <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
                Current glucose panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
                Connections panel
              </DashboardGridPanel>
            </DashboardGrid>
          )}
        </DashboardViewPanelUrlStateBridge>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));

    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/dashboard?viewPanel=panel-current-glucose');
    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.queryByText('Connections panel')).not.toBeInTheDocument();
  });

  test('opens the requested panel edit mode from an editPanel link', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams('editPanel=panel-current-glucose'));

    render(
      <NotificationsProvider>
        <DashboardViewPanelUrlStateBridge
          dashboardUid="night-view"
          allowedPanelIds={['panel-current-glucose', 'panel-connections']}
        >
          {({ viewedPanelId, onViewedPanelChange, editedPanelId, onEditedPanelChange }) => (
            <DashboardGrid
              layout={createLayout()}
              viewedPanelId={viewedPanelId}
              onViewedPanelChange={onViewedPanelChange}
              editedPanelId={editedPanelId}
              onEditedPanelChange={onEditedPanelChange}
            >
              <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
                Current glucose panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
                Connections panel
              </DashboardGridPanel>
            </DashboardGrid>
          )}
        </DashboardViewPanelUrlStateBridge>
      </NotificationsProvider>,
    );

    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.queryByText('Connections panel')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'to dashboard' })).toBeInTheDocument();
  });

  test('removes editPanel from the url when e is pressed again', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams('editPanel=panel-current-glucose'));
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <NotificationsProvider>
        <DashboardViewPanelUrlStateBridge
          dashboardUid="night-view"
          allowedPanelIds={['panel-current-glucose', 'panel-connections']}
        >
          {({ viewedPanelId, onViewedPanelChange, editedPanelId, onEditedPanelChange }) => (
            <DashboardGrid
              layout={createLayout()}
              viewedPanelId={viewedPanelId}
              onViewedPanelChange={onViewedPanelChange}
              editedPanelId={editedPanelId}
              onEditedPanelChange={onEditedPanelChange}
            >
              <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
                Current glucose panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
                Connections panel
              </DashboardGridPanel>
            </DashboardGrid>
          )}
        </DashboardViewPanelUrlStateBridge>
      </NotificationsProvider>,
    );

    fireEvent.keyDown(window, { key: 'e' });

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/dashboard');
    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.getByText('Connections panel')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Panel settings for Current Glucose' })).not.toBeInTheDocument();
  });

  test('switches editPanel to viewPanel with v and back to editPanel with e', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams('editPanel=panel-current-glucose'));
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <NotificationsProvider>
        <DashboardViewPanelUrlStateBridge
          dashboardUid="night-view"
          allowedPanelIds={['panel-current-glucose', 'panel-connections']}
        >
          {({ viewedPanelId, onViewedPanelChange, editedPanelId, onEditedPanelChange }) => (
            <DashboardGrid
              layout={createLayout()}
              viewedPanelId={viewedPanelId}
              onViewedPanelChange={onViewedPanelChange}
              editedPanelId={editedPanelId}
              onEditedPanelChange={onEditedPanelChange}
            >
              <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
                Current glucose panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
                Connections panel
              </DashboardGridPanel>
            </DashboardGrid>
          )}
        </DashboardViewPanelUrlStateBridge>
      </NotificationsProvider>,
    );

    fireEvent.keyDown(window, { key: 'v' });

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/dashboard?viewPanel=panel-current-glucose');
    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.queryByText('Connections panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Panel settings for Current Glucose' })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'e' });

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/dashboard?editPanel=panel-current-glucose');
    expect(screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' })).toBeInTheDocument();
    expect(screen.queryByText('Connections panel')).not.toBeInTheDocument();
  });

  test('pushes editPanel into the url when panel edit is opened from the menu', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    render(
      <NotificationsProvider>
        <DashboardViewPanelUrlStateBridge
          dashboardUid="night-view"
          allowedPanelIds={['panel-current-glucose', 'panel-connections']}
        >
          {({ viewedPanelId, onViewedPanelChange, editedPanelId, onEditedPanelChange }) => (
            <DashboardGrid
              layout={createLayout()}
              viewedPanelId={viewedPanelId}
              onViewedPanelChange={onViewedPanelChange}
              editedPanelId={editedPanelId}
              onEditedPanelChange={onEditedPanelChange}
            >
              <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
                Current glucose panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
                Connections panel
              </DashboardGridPanel>
            </DashboardGrid>
          )}
        </DashboardViewPanelUrlStateBridge>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/dashboard?editPanel=panel-current-glucose');
    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.queryByText('Connections panel')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' })).toBeInTheDocument();
  });

  test('removes viewPanel from the url when solo mode is closed', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams('viewPanel=panel-current-glucose'));
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <NotificationsProvider>
        <DashboardViewPanelUrlStateBridge
          dashboardUid="night-view"
          allowedPanelIds={['panel-current-glucose', 'panel-connections']}
        >
          {({ viewedPanelId, onViewedPanelChange }) => (
            <DashboardGrid
              layout={createLayout()}
              viewedPanelId={viewedPanelId}
              onViewedPanelChange={onViewedPanelChange}
            >
              <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
                Current glucose panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
                Connections panel
              </DashboardGridPanel>
            </DashboardGrid>
          )}
        </DashboardViewPanelUrlStateBridge>
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'to dashboard' }));

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/dashboard');
    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.getByText('Connections panel')).toBeInTheDocument();
  });

  test('rejects an invalid viewPanel link and shows one invalid url toast', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams('viewPanel=panel-missing'));
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <NotificationsProvider>
        <DashboardViewPanelUrlStateBridge
          dashboardTitle="Overview"
          dashboardUid="overview"
          allowedPanelIds={['panel-current-glucose', 'panel-connections']}
        >
          {({ viewedPanelId, onViewedPanelChange }) => (
            <DashboardGrid
              layout={createLayout()}
              viewedPanelId={viewedPanelId}
              onViewedPanelChange={onViewedPanelChange}
            >
              <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
                Current glucose panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
                Connections panel
              </DashboardGridPanel>
            </DashboardGrid>
          )}
        </DashboardViewPanelUrlStateBridge>
      </NotificationsProvider>,
    );

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/dashboard');
    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.getByText('Connections panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'to dashboard' })).not.toBeInTheDocument();
    expect(screen.getByText('Invalid URL parameter')).toBeInTheDocument();
    expect(screen.getByText('Redirected to Overview')).toBeInTheDocument();
  });

  test('accepts a legacy numeric panel id and normalizes the url to the stable panel key', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams('viewPanel=3'));
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <NotificationsProvider>
        <DashboardViewPanelUrlStateBridge
          dashboardUid="night-view"
          allowedPanelIds={['panel-current-glucose', 'panel-time-in-range', 'panel-connections']}
          panelIdAliases={{
            '1': 'panel-current-glucose',
            '3': 'panel-time-in-range',
            '4': 'panel-connections',
          }}
        >
          {({ viewedPanelId, onViewedPanelChange }) => (
            <DashboardGrid
              layout={{
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
                        width: 4,
                        height: 6,
                        element: {
                          kind: 'ElementReference',
                          name: 'panel-time-in-range',
                        },
                      },
                    },
                    {
                      kind: 'GridLayoutItem',
                      spec: {
                        x: 0,
                        y: 6,
                        width: 12,
                        height: 8,
                        element: {
                          kind: 'ElementReference',
                          name: 'panel-connections',
                        },
                      },
                    },
                  ],
                },
              }}
              viewedPanelId={viewedPanelId}
              onViewedPanelChange={onViewedPanelChange}
            >
              <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
                Current glucose panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-time-in-range" panelId="panel-time-in-range" title="Time in Range">
                Time in range panel
              </DashboardGridPanel>
              <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
                Connections panel
              </DashboardGridPanel>
            </DashboardGrid>
          )}
        </DashboardViewPanelUrlStateBridge>
      </NotificationsProvider>,
    );

    expect(screen.getByText('Time in range panel')).toBeInTheDocument();
    expect(screen.queryByText('Current glucose panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Connections panel')).not.toBeInTheDocument();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/dashboard?viewPanel=panel-time-in-range');
  });
});
