// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { GridLayoutKind, GridLayoutItemKind } from '@/lib/dashboard/schema';
import { DashboardGrid } from './DashboardGrid';
import { DashboardGridPanel } from './DashboardGridPanel';

type MockLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const gridLayoutMock = vi.hoisted(() => ({
  layout: [] as MockLayoutItem[],
  onLayoutChange: undefined as ((layout: MockLayoutItem[]) => void) | undefined,
  className: '',
  gridConfig: undefined as
    | {
        cols: number;
        rowHeight: number;
        margin: readonly [number, number];
        containerPadding: readonly [number, number];
      }
    | undefined,
  dragConfig: undefined as
    | {
        enabled: boolean;
        handle?: string;
        cancel?: string;
      }
    | undefined,
  resizeConfig: undefined as
    | {
        enabled: boolean;
      }
    | undefined,
  width: 960,
  mounted: true,
}));

vi.mock('react-grid-layout', () => ({
  default: ({
    children,
    layout,
    onLayoutChange,
    width,
    gridConfig,
    dragConfig,
    resizeConfig,
    className,
  }: {
    children: ReactNode;
    layout: MockLayoutItem[];
    onLayoutChange?: (layout: MockLayoutItem[]) => void;
    width: number;
    gridConfig?: {
      cols: number;
      rowHeight: number;
      margin: readonly [number, number];
      containerPadding: readonly [number, number];
    };
    className?: string;
    dragConfig?: {
      enabled: boolean;
      handle?: string;
      cancel?: string;
    };
    resizeConfig?: {
      enabled: boolean;
    };
  }) => {
    gridLayoutMock.layout = layout;
    gridLayoutMock.onLayoutChange = onLayoutChange;
    gridLayoutMock.gridConfig = gridConfig;
    gridLayoutMock.dragConfig = dragConfig;
    gridLayoutMock.resizeConfig = resizeConfig;
    gridLayoutMock.className = className ?? '';

    return (
      <section
        data-testid="dashboard-grid-layout"
        data-layout={JSON.stringify(layout)}
        data-width={width}
      >
        {children}
      </section>
    );
  },
  useContainerWidth: () => ({
    containerRef: { current: null },
    mounted: gridLayoutMock.mounted,
    width: gridLayoutMock.width,
  }),
  noCompactor: () => [],
}));

function gridItem(
  name: string,
  spec: Pick<GridLayoutItemKind['spec'], 'x' | 'y' | 'width' | 'height'>,
): GridLayoutItemKind {
  return {
    kind: 'GridLayoutItem',
    spec: {
      ...spec,
      element: {
        kind: 'ElementReference',
        name,
      },
    },
  };
}

function createLayout(): GridLayoutKind {
  return {
    kind: 'GridLayout',
    spec: {
      items: [
        gridItem('panel-current-glucose', { x: 0, y: 0, width: 4, height: 6 }),
        gridItem('panel-connections', { x: 0, y: 6, width: 12, height: 8 }),
      ],
    },
  };
}

describe('DashboardGrid', () => {
  test('waits for a measured container width before rendering the grid', () => {
    gridLayoutMock.mounted = false;

    render(
      <DashboardGrid layout={createLayout()}>
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    expect(screen.queryByTestId('dashboard-grid-layout')).not.toBeInTheDocument();

    gridLayoutMock.mounted = true;
  });

  test('shows panel actions only while dashboard edit mode is active', () => {
    render(
      <DashboardGrid layout={createLayout()}>
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
        <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
          Connections panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    expect(screen.queryByRole('button', { name: 'Open panel actions for Current Glucose' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    const actionsButton = screen.getByRole('button', { name: 'Open panel actions for Current Glucose' });
    const panel = document.querySelector('[data-dashboard-panel-id="panel-current-glucose"]');

    expect(actionsButton).toHaveClass('cursor-pointer');
    expect(panel).toHaveClass('[&_.dashboard-panel-drag-handle]:cursor-move');
    expect(actionsButton.querySelectorAll('span span')).toHaveLength(3);

    fireEvent.click(actionsButton);

    expect(screen.getByRole('menu', { name: 'Panel actions for Current Glucose' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exit dashboard edit mode' }));

    expect(screen.queryByRole('menu', { name: 'Panel actions for Current Glucose' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open panel actions for Current Glucose' })).not.toBeInTheDocument();
    expect(panel).not.toHaveClass('[&_.dashboard-panel-drag-handle]:cursor-move');
  });

  test('focuses one panel in the dashboard area when View is selected', () => {
    render(
      <DashboardGrid layout={createLayout()}>
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
        <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
          Connections panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));

    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.queryByText('Connections panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all dashboard panels' })).toBeInTheDocument();
    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 12, h: 6 },
    ]);
  });

  test('opens a panel settings drawer when Edit is selected', () => {
    render(
      <DashboardGrid layout={createLayout()}>
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
        <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
          Connections panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Current Glucose settings' })).toBeInTheDocument();
    expect(screen.getByText('No settings available yet.')).toBeInTheDocument();
  });

  test('enables admin save only after panel settings differ from persisted settings', async () => {
    const onSaveDashboard = vi.fn().mockResolvedValue(undefined);

    render(
      <DashboardGrid
        layout={createLayout()}
        isOwner
        initialPanelSettings={{
          'panel-current-glucose': { colorMode: 'threeColors' },
        }}
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
        onSaveDashboard={onSaveDashboard}
      >
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' });
    const saveButton = within(drawer).getByRole('button', { name: 'Save' });

    expect(saveButton).toBeDisabled();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Gradient' }));

    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSaveDashboard).toHaveBeenCalledWith({
        panelSettings: {
          'panel-current-glucose': { colorMode: 'gradient' },
        },
        layout: [
          { i: 'panel-current-glucose', x: 0, y: 0, w: 4, h: 6 },
          { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
        ],
      });
    });

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
  });

  test('shows a save-attempt callback for non-admin users without calling the save handler', async () => {
    const onSaveDashboard = vi.fn().mockResolvedValue(undefined);
    const onUnauthorizedSaveDashboard = vi.fn();

    render(
      <DashboardGrid
        layout={createLayout()}
        onSaveDashboard={onSaveDashboard}
        onUnauthorizedSaveDashboard={onUnauthorizedSaveDashboard}
        initialPanelSettings={{
          'panel-current-glucose': { colorMode: 'threeColors' },
        }}
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
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' });
    const saveButton = within(drawer).getByRole('button', { name: 'Save' });

    expect(saveButton).toBeDisabled();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Gradient' }));

    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    expect(onUnauthorizedSaveDashboard).toHaveBeenCalledTimes(1);
    expect(onSaveDashboard).not.toHaveBeenCalled();
  });

  test('enables layout editing only in dashboard edit mode', () => {
    const { rerender } = render(
      <DashboardGrid layout={createLayout()}>
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    expect(gridLayoutMock.dragConfig).toEqual({
      enabled: false,
      handle: '.dashboard-panel-drag-handle',
      cancel: '.grid-drag-cancel,button,input,select,textarea,a',
    });
    expect(gridLayoutMock.resizeConfig).toEqual({
      enabled: false,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));

    expect(gridLayoutMock.dragConfig).toEqual({
      enabled: true,
      handle: '.dashboard-panel-drag-handle',
      cancel: '.grid-drag-cancel,button,input,select,textarea,a',
    });
    expect(gridLayoutMock.resizeConfig).toEqual({
      enabled: true,
    });
    expect(gridLayoutMock.className).toContain('dashboard-grid--editing');

    gridLayoutMock.width = 640;

    rerender(
      <DashboardGrid layout={createLayout()}>
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    expect(gridLayoutMock.dragConfig).toEqual({
      enabled: false,
      handle: '.dashboard-panel-drag-handle',
      cancel: '.grid-drag-cancel,button,input,select,textarea,a',
    });
    expect(gridLayoutMock.resizeConfig).toEqual({
      enabled: false,
    });
  });

  test('renders dashboard edit controls into a portal target when provided', async () => {
    render(
      <>
        <div data-testid="dashboard-edit-controls-target" id="dashboard-edit-controls-target" />
        <DashboardGrid layout={createLayout()} editControlsPortalId="dashboard-edit-controls-target">
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGrid>
      </>,
    );

    const target = screen.getByTestId('dashboard-edit-controls-target');

    await waitFor(() => {
      expect(within(target).getByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument();
    });

    expect(within(target).getByRole('button', { name: 'Edit dashboard' })).toHaveClass(
      'h-[38px]',
      'border-dashboard-time-picker-border',
      'bg-dashboard-time-picker-bg',
      'text-dashboard-time-picker-text',
    );
    expect(document.querySelector('#dashboard-edit-controls-target use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#edit',
    );

    fireEvent.click(within(target).getByRole('button', { name: 'Edit dashboard' }));

    const controls = target.firstElementChild;
    const saveButton = within(target).getByRole('button', { name: 'Save dashboard' });
    const closeButton = within(target).getByRole('button', { name: 'Exit dashboard edit mode' });
    const publicSaveWarning = within(target).getByText(
      'Admin sign in is required to save dashboard settings.',
    );

    expect(controls).toHaveClass('flex-wrap', 'items-center');
    expect(controls?.children[0]).toContainElement(saveButton);
    expect(controls?.children[0]).toContainElement(closeButton);
    expect(controls?.children[1]).toBe(publicSaveWarning);
  });

  test('enables move animations after mount when dragging is available', async () => {
    gridLayoutMock.mounted = true;
    gridLayoutMock.width = 960;

    render(
      <DashboardGrid layout={createLayout()}>
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    expect(gridLayoutMock.className).toBe('dashboard-grid');

    await waitFor(() => {
      expect(gridLayoutMock.className).toBe('dashboard-grid react-grid-layout--enable-move-animations');
    });
  });

  test('renders grid children by their dashboard layout keys', () => {
    render(
      <DashboardGrid layout={createLayout()}>
        <div key="panel-current-glucose">Current glucose panel</div>
        <div key="panel-connections">Connections panel</div>
      </DashboardGrid>,
    );

    expect(screen.getByTestId('dashboard-grid-layout')).toBeInTheDocument();
    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.getByText('Connections panel')).toBeInTheDocument();
    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 4, h: 6 },
      { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
    ]);
    expect(gridLayoutMock.gridConfig?.margin).toEqual([4, 4]);
  });

  test('keeps drag and resize changes in local runtime state', () => {
    render(
      <DashboardGrid layout={createLayout()}>
        <div key="panel-current-glucose">Current glucose panel</div>
        <div key="panel-connections">Connections panel</div>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));

    act(() => {
      gridLayoutMock.onLayoutChange?.([
        { i: 'panel-current-glucose', x: 2, y: 1, w: 5, h: 7 },
        { i: 'panel-connections', x: 0, y: 8, w: 12, h: 8 },
      ]);
    });

    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 2, y: 1, w: 5, h: 7 },
      { i: 'panel-connections', x: 0, y: 8, w: 12, h: 8 },
    ]);
  });

  test('restores the dashboard definition layout when remounted', () => {
    const layout = createLayout();
    const { unmount } = render(
      <DashboardGrid layout={layout}>
        <div key="panel-current-glucose">Current glucose panel</div>
        <div key="panel-connections">Connections panel</div>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));

    act(() => {
      gridLayoutMock.onLayoutChange?.([
        { i: 'panel-current-glucose', x: 2, y: 1, w: 5, h: 7 },
        { i: 'panel-connections', x: 0, y: 8, w: 12, h: 8 },
      ]);
    });
    unmount();

    render(
      <DashboardGrid layout={layout}>
        <div key="panel-current-glucose">Current glucose panel</div>
        <div key="panel-connections">Connections panel</div>
      </DashboardGrid>,
    );

    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 4, h: 6 },
      { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
    ]);
  });

  test('asks before discarding unsaved dashboard layout changes', () => {
    render(
      <DashboardGrid layout={createLayout()} isOwner>
        <div key="panel-current-glucose">Current glucose panel</div>
        <div key="panel-connections">Connections panel</div>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));

    act(() => {
      gridLayoutMock.onLayoutChange?.([
        { i: 'panel-current-glucose', x: 2, y: 1, w: 5, h: 7 },
        { i: 'panel-connections', x: 0, y: 8, w: 12, h: 8 },
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Exit dashboard edit mode' }));

    expect(screen.getByRole('dialog', { name: 'Discard unsaved dashboard changes?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(screen.queryByRole('dialog', { name: 'Discard unsaved dashboard changes?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument();
    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 4, h: 6 },
      { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
    ]);
  });

  test('silently discards public preview changes when exiting dashboard edit mode', () => {
    render(
      <DashboardGrid layout={createLayout()}>
        <div key="panel-current-glucose">Current glucose panel</div>
        <div key="panel-connections">Connections panel</div>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));

    act(() => {
      gridLayoutMock.onLayoutChange?.([
        { i: 'panel-current-glucose', x: 2, y: 1, w: 5, h: 7 },
        { i: 'panel-connections', x: 0, y: 8, w: 12, h: 8 },
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Exit dashboard edit mode' }));

    expect(screen.queryByRole('dialog', { name: 'Discard unsaved dashboard changes?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument();
    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 4, h: 6 },
      { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
    ]);
  });

  test('does not mark registry defaults as unsaved changes on first render', () => {
    render(
      <DashboardGrid
        layout={createLayout()}
        settingsRegistry={{
          'panel-current-glucose': {
            defaultSettings: { colorMode: 'threeColors', yAxisMax: 25 },
            render: () => <p>Settings</p>,
          },
        }}
        initialPanelSettings={{
          'panel-current-glucose': {},
        }}
      >
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit dashboard edit mode' }));

    expect(screen.queryByRole('dialog', { name: 'Discard unsaved dashboard changes?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument();
  });
});
