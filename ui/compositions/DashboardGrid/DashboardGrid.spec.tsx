// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { DashboardPanelCatalogEntry } from '@/lib/dashboard/panel-catalog';
import type { GridLayoutKind, GridLayoutItemKind, PanelKind } from '@/lib/dashboard/schema';
import {
  DashboardGrid,
  useDashboardPanelSettings,
  type DashboardPanelSettingsRegistry,
} from './DashboardGrid';
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
  childKeys: [] as Array<string | null>,
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
    const childList = Array.isArray(children) ? children : [children];

    gridLayoutMock.layout = layout;
    gridLayoutMock.childKeys = childList.map((child) => (
      child && typeof child === 'object' && 'key' in child ? String(child.key) : null
    ));
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

function createEmptyLayout(): GridLayoutKind {
  return {
    kind: 'GridLayout',
    spec: {
      items: [],
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

function CurrentGlucoseUnitReadout() {
  const [settings] = useDashboardPanelSettings(
    'panel-current-glucose',
    { unit: 'mmol/L' },
  );

  return <span>Unit: {settings.unit}</span>;
}

describe('DashboardGrid', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  test('reveals panel actions on hover and closes the menu on outside click', () => {
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

    const panel = document.querySelector('[data-dashboard-panel-id="panel-current-glucose"]') as Element;
    const actionsButton = screen.getByRole('button', { name: 'Open panel actions for Current Glucose' });

    expect(actionsButton).toHaveClass('opacity-0', 'pointer-events-none');

    fireEvent.mouseEnter(panel);

    expect(actionsButton).toHaveClass('opacity-100');
    expect(actionsButton).not.toHaveClass('pointer-events-none');
    expect(actionsButton.querySelectorAll('span span')).toHaveLength(3);

    fireEvent.click(actionsButton);

    const menu = screen.getByRole('menu', { name: 'Panel actions for Current Glucose' });
    const viewMenuItem = screen.getByRole('menuitem', { name: 'View' });

    expect(menu).toHaveClass(
      'bg-dashboard-panel-menu-bg',
      'border-dashboard-panel-menu-border',
      'shadow-dashboard-panel-menu',
    );
    expect(viewMenuItem).toBeInTheDocument();
    expect(within(viewMenuItem).getByText('V').tagName).toBe('KBD');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('menu', { name: 'Panel actions for Current Glucose' })).not.toBeInTheDocument();
    expect(actionsButton).toHaveClass('opacity-100');
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
    expect(screen.getByRole('button', { name: 'to dashboard' })).toBeInTheDocument();
    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 12, h: 14 },
    ]);
  });

  test('toggles solo view for the hovered panel when v is pressed', () => {
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

    fireEvent.mouseEnter(document.querySelector('[data-dashboard-panel-id="panel-connections"]') as Element);
    fireEvent.keyDown(window, { key: 'v' });

    expect(screen.getByText('Connections panel')).toBeInTheDocument();
    expect(screen.queryByText('Current glucose panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'to dashboard' })).toBeInTheDocument();
  });

  test('toggles solo view when the panel is already hovered before React sees mouse movement', () => {
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

    const originalQuerySelectorAll = HTMLElement.prototype.querySelectorAll;
    const connectionsPanel = document.querySelector('[data-dashboard-panel-id="panel-connections"]') as HTMLElement;
    const querySelectorAllSpy = vi.spyOn(HTMLElement.prototype, 'querySelectorAll').mockImplementation(function (
      this: HTMLElement,
      selector,
    ) {
      if (selector === '[data-dashboard-panel-id]:hover' && this.contains(connectionsPanel)) {
        return [connectionsPanel] as unknown as NodeListOf<HTMLElement>;
      }

      return originalQuerySelectorAll.call(this, selector) as NodeListOf<HTMLElement>;
    });

    fireEvent.keyDown(window, { key: 'v' });

    expect(screen.getByText('Connections panel')).toBeInTheDocument();
    expect(screen.queryByText('Current glucose panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'to dashboard' })).toBeInTheDocument();

    querySelectorAllSpy.mockRestore();
  });

  test('exits solo view when v is pressed again for the hovered panel', () => {
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

    const connectionsPanel = document.querySelector('[data-dashboard-panel-id="panel-connections"]') as Element;

    fireEvent.mouseEnter(connectionsPanel);
    fireEvent.keyDown(window, { key: 'v' });

    expect(screen.queryByText('Current glucose panel')).not.toBeInTheDocument();

    fireEvent.mouseEnter(connectionsPanel);
    fireEvent.keyDown(window, { key: 'v' });

    expect(screen.getByText('Current glucose panel')).toBeInTheDocument();
    expect(screen.getByText('Connections panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'to dashboard' })).not.toBeInTheDocument();
  });

  test('ignores the v shortcut inside editable fields', () => {
    render(
      <DashboardGrid layout={createLayout()}>
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          <div className="grid gap-2">
            <input aria-label="Shortcut input" />
            <textarea aria-label="Shortcut textarea" />
            <select aria-label="Shortcut select" defaultValue="one">
              <option value="one">One</option>
            </select>
          </div>
        </DashboardGridPanel>
        <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
          <div contentEditable suppressContentEditableWarning>
            Editable content
          </div>
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    fireEvent.mouseEnter(document.querySelector('[data-dashboard-panel-id="panel-current-glucose"]') as Element);

    fireEvent.keyDown(screen.getByLabelText('Shortcut input'), { key: 'v' });
    expect(screen.getByLabelText('Shortcut input')).toBeInTheDocument();
    expect(screen.getByLabelText('Shortcut textarea')).toBeInTheDocument();
    expect(screen.getByLabelText('Shortcut select')).toBeInTheDocument();
    expect(screen.getByText('Editable content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'to dashboard' })).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText('Shortcut textarea'), { key: 'v' });
    expect(screen.getByLabelText('Shortcut input')).toBeInTheDocument();
    expect(screen.getByLabelText('Shortcut textarea')).toBeInTheDocument();
    expect(screen.getByLabelText('Shortcut select')).toBeInTheDocument();
    expect(screen.getByText('Editable content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'to dashboard' })).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText('Shortcut select'), { key: 'v' });
    expect(screen.getByLabelText('Shortcut input')).toBeInTheDocument();
    expect(screen.getByLabelText('Shortcut textarea')).toBeInTheDocument();
    expect(screen.getByLabelText('Shortcut select')).toBeInTheDocument();
    expect(screen.getByText('Editable content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'to dashboard' })).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByText('Editable content'), { key: 'v' });
    expect(screen.getByLabelText('Shortcut input')).toBeInTheDocument();
    expect(screen.getByText('Editable content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'to dashboard' })).not.toBeInTheDocument();
  });

  test('caps solo panel height to the remaining viewport height and makes the panel body scrollable', async () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 400,
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 112,
      top: 112,
      right: 960,
      bottom: 212,
      left: 0,
      width: 960,
      height: 100,
      toJSON: () => ({}),
    });

    render(
      <main style={{ paddingBottom: '32px' }}>
        <DashboardGrid layout={createLayout()}>
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
          <DashboardGridPanel key="panel-connections" panelId="panel-connections" title="Connections">
            Connections panel
          </DashboardGridPanel>
        </DashboardGrid>
      </main>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));

    await waitFor(() => {
      expect(gridLayoutMock.layout).toEqual([
        { i: 'panel-current-glucose', x: 0, y: 0, w: 12, h: 7 },
      ]);
    });

    expect(document.querySelector('[data-dashboard-panel-id="panel-current-glucose"]')).toHaveClass(
      '[&>section>div:last-child]:overflow-y-auto',
    );
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

    fireEvent.mouseEnter(document.querySelector('[data-dashboard-panel-id="panel-current-glucose"]') as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit dashboard edit mode' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Current Glucose settings' })).toBeInTheDocument();
    expect(screen.getByText('No settings available yet.')).toBeInTheDocument();
  });

  test('exits edit mode and closes the settings drawer when entering solo panel view', () => {
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
    expect(screen.getByRole('button', { name: 'Exit dashboard edit mode' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Connections' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));

    expect(screen.getByText('Connections panel')).toBeInTheDocument();
    expect(screen.queryByText('Current glucose panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Panel settings for Current Glucose' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exit dashboard edit mode' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open panel actions for Connections' })).toHaveClass(
      'opacity-0',
      'pointer-events-none',
    );
    expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument();
  });

  test('enables admin save only after panel settings differ from persisted settings', async () => {
    const onSaveDashboard = vi.fn().mockResolvedValue(undefined);

    render(
      <DashboardGrid
        layout={createLayout()}
        isOwner
        initialPanelSettings={{
          'panel-current-glucose': { colorMode: 'standard' },
        }}
        initialElements={{
          'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
        }}
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
    const closeButton = within(drawer).getByRole('button', { name: 'Close' });
    const header = drawer.firstElementChild;

    expect(saveButton).toBeDisabled();
    expect(header).toContainElement(saveButton);
    expect(header).toContainElement(closeButton);

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

  test('lets panel settings resize the edited panel to a visual aspect ratio', async () => {
    const onSaveDashboard = vi.fn().mockResolvedValue(undefined);

    render(
      <DashboardGrid
        layout={createLayout()}
        isOwner
        initialPanelSettings={{
          'panel-current-glucose': { contentAlignment: 'vertical' },
        }}
        initialElements={{
          'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
        }}
        settingsRegistry={{
          'veno.live-glucose': {
            defaultSettings: { contentAlignment: 'vertical' },
            render: ({ updateSettings, resizeLayoutToAspectRatio }) => (
              <button
                type="button"
                onClick={() => {
                  updateSettings((current) => ({
                    ...(current as { contentAlignment: string }),
                    contentAlignment: 'horizontal',
                  }));
                  resizeLayoutToAspectRatio?.({
                    aspectRatio: 2.1,
                    minWidth: 5,
                    maxWidth: 8,
                    minHeight: 5,
                    maxHeight: 10,
                  });
                }}
              >
                Horizontal
              </button>
            ),
          },
        }}
        onSaveDashboard={onSaveDashboard}
      >
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

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Horizontal' }));

    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 5, h: 5 },
      { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
    ]);

    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaveDashboard).toHaveBeenCalledWith({
        panelSettings: {
          'panel-current-glucose': { contentAlignment: 'horizontal' },
        },
        layout: [
          { i: 'panel-current-glucose', x: 0, y: 0, w: 5, h: 5 },
          { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
        ],
      });
    });
  });

  test('keeps saved panel settings through parent rerenders with stale initial settings', async () => {
    const onSaveDashboard = vi.fn().mockResolvedValue(undefined);
    const initialPanelSettings = {
      'panel-current-glucose': { unit: 'mmol/L' },
    };
    const settingsRegistry: DashboardPanelSettingsRegistry = {
      'veno.live-glucose': {
        defaultSettings: { unit: 'mmol/L' },
        render: ({ updateSettings }) => (
          <button
            type="button"
            onClick={() => {
              updateSettings((current) => ({
                ...(current as { unit: string }),
                unit: 'mg/dL',
              }));
            }}
          >
            mg/dl
          </button>
        ),
      },
    };

    const { rerender } = render(
      <DashboardGrid
        layout={createLayout()}
        isOwner
        initialPanelSettings={initialPanelSettings}
        initialElements={{
          'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
        }}
        settingsRegistry={settingsRegistry}
        onSaveDashboard={onSaveDashboard}
      >
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          <CurrentGlucoseUnitReadout />
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Current Glucose' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'mg/dl' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaveDashboard).toHaveBeenCalledWith({
        panelSettings: {
          'panel-current-glucose': { unit: 'mg/dL' },
        },
        layout: [
          { i: 'panel-current-glucose', x: 0, y: 0, w: 4, h: 6 },
          { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
        ],
      });
    });
    expect(screen.getByText('Unit: mg/dL')).toBeInTheDocument();

    rerender(
      <DashboardGrid
        layout={createLayout()}
        isOwner
        initialPanelSettings={{
          'panel-current-glucose': { unit: 'mmol/L' },
        }}
        initialElements={{
          'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
        }}
        settingsRegistry={settingsRegistry}
        onSaveDashboard={onSaveDashboard}
      >
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          <CurrentGlucoseUnitReadout />
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    expect(screen.getByText('Unit: mg/dL')).toBeInTheDocument();
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
          'panel-current-glucose': { colorMode: 'standard' },
        }}
        initialElements={{
          'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
        }}
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

  test('left aligns internal dashboard edit controls when no toolbar portal is provided', () => {
    render(
      <DashboardGrid layout={createLayout()}>
        <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
          Current glucose panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    const editButton = screen.getByRole('button', { name: 'Edit dashboard' });
    const controlsRow = editButton.closest('.mb-4');

    expect(controlsRow).toHaveClass('justify-start');
    expect(controlsRow).not.toHaveClass('justify-end');
  });

  test('renders the solo view back action into the same portal toolbar row', async () => {
    render(
      <>
        <div data-testid="dashboard-edit-controls-target" id="dashboard-edit-controls-target" />
        <DashboardGrid
          layout={createLayout()}
          editControlsPortalId="dashboard-edit-controls-target"
          viewedPanelId="panel-current-glucose"
        >
          <DashboardGridPanel key="panel-current-glucose" panelId="panel-current-glucose" title="Current Glucose">
            Current glucose panel
          </DashboardGridPanel>
        </DashboardGrid>
      </>,
    );

    const target = screen.getByTestId('dashboard-edit-controls-target');

    await waitFor(() => {
      expect(within(target).getByRole('button', { name: 'to dashboard' })).toBeInTheDocument();
    });

    expect(within(target).getByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument();
    expect(document.querySelector('#dashboard-edit-controls-target use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#chevron-left',
    );
  });

  test('enables move animations only while editing the dashboard layout', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));

    await waitFor(() => {
      expect(gridLayoutMock.className).toBe(
        'dashboard-grid dashboard-grid--editing react-grid-layout--enable-move-animations',
      );
    });
  });

  test('disables move animations while a panel is in solo view', async () => {
    gridLayoutMock.mounted = true;
    gridLayoutMock.width = 960;

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

    await waitFor(() => {
      expect(gridLayoutMock.className).toBe(
        'dashboard-grid dashboard-grid--editing react-grid-layout--enable-move-animations',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Current Glucose' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));

    expect(gridLayoutMock.className).toBe('dashboard-grid');
  });

  test('keeps move animations disabled after exiting solo view', async () => {
    gridLayoutMock.mounted = true;
    gridLayoutMock.width = 960;

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

    fireEvent.mouseEnter(document.querySelector('[data-dashboard-panel-id="panel-connections"]') as Element);
    fireEvent.keyDown(window, { key: 'v' });

    expect(gridLayoutMock.className).toBe('dashboard-grid');

    fireEvent.mouseEnter(document.querySelector('[data-dashboard-panel-id="panel-connections"]') as Element);
    fireEvent.keyDown(window, { key: 'v' });

    expect(gridLayoutMock.className).toBe('dashboard-grid');
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
    expect(gridLayoutMock.childKeys).toEqual([
      'panel-current-glucose',
      'panel-connections',
    ]);
    expect(gridLayoutMock.gridConfig?.cols).toBe(12);
    expect(gridLayoutMock.gridConfig?.margin).toEqual([4, 4]);
  });

  test('sizes added panels from their default visual aspect ratio', () => {
    const panelCatalogEntries = [
      {
        id: 'current-glucose',
        elementName: 'panel-current-glucose',
        title: 'Current Glucose',
        group: 'veno.live-glucose',
        compatibleDashboardTypes: ['live'],
        allowMultiple: false,
        defaultLayout: { width: 4, height: 9, aspectRatio: 2 },
        defaultDefinition: createPanel('veno.live-glucose', 'Current Glucose'),
      },
    ] satisfies DashboardPanelCatalogEntry[];

    render(
      <DashboardGrid
        layout={createEmptyLayout()}
        dashboardType="live"
        isOwner
        panelCatalogEntries={panelCatalogEntries}
        renderPanel={(panelId, panel) => (
          <div key={panelId}>{panel.spec.title} panel</div>
        )}
      >
        {null}
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add panel' }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Add panel' })).getByRole('button', { name: 'Current Glucose' }));

    expect(screen.getByText('Current Glucose panel')).toBeInTheDocument();
    expect(gridLayoutMock.layout).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 4, h: 5 },
    ]);
  });

  test('creates unique element keys for addable panels that allow multiple instances', () => {
    const panelCatalogEntries = [
      {
        id: 'text',
        elementName: 'panel-text',
        title: 'Text',
        group: 'veno.text',
        compatibleDashboardTypes: ['live'],
        allowMultiple: true,
        defaultLayout: { width: 4, height: 6, aspectRatio: 1.45 },
        defaultDefinition: createPanel('veno.text', 'Text'),
      },
    ] satisfies DashboardPanelCatalogEntry[];

    render(
      <DashboardGrid
        layout={createEmptyLayout()}
        dashboardType="live"
        isOwner
        panelCatalogEntries={panelCatalogEntries}
        renderPanel={(panelId, panel) => (
          <div key={panelId}>{panelId}: {panel.spec.title}</div>
        )}
      >
        {null}
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add panel' }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Add panel' })).getByRole('button', { name: 'Text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add panel' }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Add panel' })).getByRole('button', { name: 'Text' }));

    expect(screen.getByText('panel-text: Text')).toBeInTheDocument();
    expect(screen.getByText('panel-text-2: Text')).toBeInTheDocument();
    expect(gridLayoutMock.layout.map((item) => item.i)).toEqual(['panel-text', 'panel-text-2']);
  });

  test('uses one group settings registration for multiple panel instances', async () => {
    const onSaveDashboard = vi.fn().mockResolvedValue(undefined);
    const layout: GridLayoutKind = {
      kind: 'GridLayout',
      spec: {
        items: [
          gridItem('panel-text', { x: 0, y: 0, width: 4, height: 6 }),
          gridItem('panel-text-2', { x: 4, y: 0, width: 4, height: 6 }),
        ],
      },
    };
    const initialElements = {
      'panel-text': createPanel('veno.text', 'Text'),
      'panel-text-2': createPanel('veno.text', 'Text'),
    };

    render(
      <DashboardGrid
        layout={layout}
        isOwner
        initialElements={initialElements}
        initialPanelSettings={{
          'panel-text': { text: 'First' },
          'panel-text-2': { text: 'Second' },
        }}
        settingsRegistry={{
          'veno.text': {
            defaultSettings: { text: '' },
            render: ({ updateSettings }) => (
              <button
                type="button"
                onClick={() => {
                  updateSettings((current) => ({
                    ...(current as { text: string }),
                    text: 'Edited second',
                  }));
                }}
              >
                Edit text
              </button>
            ),
          },
        }}
        onSaveDashboard={onSaveDashboard}
      >
        <DashboardGridPanel key="panel-text" panelId="panel-text" title="Text">
          First text panel
        </DashboardGridPanel>
        <DashboardGridPanel key="panel-text-2" panelId="panel-text-2" title="Text">
          Second text panel
        </DashboardGridPanel>
      </DashboardGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(
      within(document.querySelector('[data-dashboard-panel-id="panel-text-2"]') as HTMLElement)
        .getByRole('button', { name: 'Open panel actions for Text' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Panel settings for Text' })).getByRole('button', { name: 'Edit text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save dashboard' }));

    await waitFor(() => {
      expect(onSaveDashboard).toHaveBeenCalledWith({
        panelSettings: {
          'panel-text': { text: 'First' },
          'panel-text-2': { text: 'Edited second' },
        },
        layout: [
          { i: 'panel-text', x: 0, y: 0, w: 4, h: 6 },
          { i: 'panel-text-2', x: 4, y: 0, w: 4, h: 6 },
        ],
      });
    });
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
          'veno.live-glucose': {
            defaultSettings: { colorMode: 'standard', yAxisMax: 25 },
            render: () => <p>Settings</p>,
          },
        }}
        initialElements={{
          'panel-current-glucose': createPanel('veno.live-glucose', 'Current Glucose'),
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
