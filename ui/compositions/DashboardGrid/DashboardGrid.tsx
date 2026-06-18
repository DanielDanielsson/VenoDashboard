'use client';

import { Children, cloneElement, createContext, isValidElement, useContext, useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactGridLayout, { useContainerWidth, type Layout } from 'react-grid-layout';
import { cloneReactGridLayoutItems, toReactGridLayoutItems } from '@/lib/dashboard/grid-layout';
import type { DashboardTimeSettingsKind, DashboardType, GridLayoutKind, PanelKind } from '@/lib/dashboard/schema';
import { allowsMultiplePanelInstances, type DashboardPanelCatalogEntry } from '@/lib/dashboard/panel-catalog';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { DialogPanel } from '@ui/components/DialogPanel';
import { SecondaryButton } from '@ui/components/SecondaryButton';

export interface DashboardPanelSettingsRegistration<TSettings = unknown> {
  defaultSettings: TSettings;
  render: (input: {
    settings: TSettings;
    updateSettings: (updater: (current: TSettings) => TSettings) => void;
    updateLayout?: (updater: (current: DashboardPanelLayoutState) => DashboardPanelLayoutState) => void;
    resizeLayoutToAspectRatio?: (options: DashboardPanelAspectRatioLayoutOptions) => void;
    isOwner: boolean;
  }) => ReactNode;
}

export type DashboardPanelSettingsGroup = string;
export type DashboardPanelSettingsRegistry = Record<DashboardPanelSettingsGroup, DashboardPanelSettingsRegistration>;

export interface DashboardPanelLayoutState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DashboardPanelAspectRatioLayoutOptions {
  aspectRatio: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

interface DashboardGridProps {
  layout: GridLayoutKind;
  children: ReactNode;
  dashboardType?: DashboardType;
  isOwner?: boolean;
  viewedPanelId?: string | null;
  onViewedPanelChange?: (panelId: string | null, navigationMode?: 'push' | 'replace') => void;
  editedPanelId?: string | null;
  onEditedPanelChange?: (panelId: string | null, navigationMode?: 'push' | 'replace') => void;
  settingsRegistry?: DashboardPanelSettingsRegistry;
  initialElements?: Record<string, PanelKind>;
  renderPanel?: (panelId: string, panel: PanelKind) => ReactNode;
  panelCatalogEntries?: DashboardPanelCatalogEntry[];
  initialPanelSettings?: Record<string, unknown>;
  initialTimeSettings?: DashboardTimeSettingsKind;
  currentTimeSettings?: DashboardTimeSettingsKind;
  onDiscardTimeSettings?: (timeSettings: DashboardTimeSettingsKind) => void;
  editControlsPortalId?: string;
  onUnauthorizedSaveDashboard?: () => void;
  onSaveDashboard?: (input: {
    panelSettings: Record<string, unknown>;
    layout: Layout;
    elements?: Record<string, PanelKind>;
    timeSettings?: DashboardTimeSettingsKind;
  }) => Promise<void>;
  onDeleteDashboard?: () => Promise<void>;
}

const gridConfig = {
  cols: 12,
  rowHeight: 32,
  margin: [4, 4] as const,
  containerPadding: [0, 0] as const,
};
const DEFAULT_ADDED_PANEL_ASPECT_RATIO = 1.35;
const EMPTY_PANEL_SETTINGS: Record<string, unknown> = {};
const EMPTY_PANEL_ELEMENTS: Record<string, PanelKind> = {};
const DASHBOARD_EDIT_BUTTON_STYLES = 'ui_caption inline-flex h-[38px] items-center gap-2 rounded-[4px] border border-dashboard-time-picker-border bg-dashboard-time-picker-bg px-3 text-dashboard-time-picker-text transition-colors hover:bg-dashboard-time-picker-bg-hover hover:text-dashboard-time-picker-text';
const DASHBOARD_PANEL_SELECTOR = '[data-dashboard-panel-id]';

interface DashboardGridActions {
  viewPanel: (panelId: string) => void;
  editPanel: (panel: { panelId: string; title: string }) => void;
  removePanel: (panelId: string) => void;
  setHoveredPanel: (panelId: string | null) => void;
  hoveredPanelId: string | null;
  isOwner: boolean;
  isEditMode: boolean;
  isLayoutEditingEnabled: boolean;
  viewedPanelId: string | null;
}

const DashboardGridActionsContext = createContext<DashboardGridActions>({
  viewPanel: () => {},
  editPanel: () => {},
  removePanel: () => {},
  setHoveredPanel: () => {},
  hoveredPanelId: null,
  isOwner: false,
  isEditMode: false,
  isLayoutEditingEnabled: false,
  viewedPanelId: null,
});

interface DashboardPanelSettingsContextValue {
  getSettings: <TSettings>(panelId: string, defaultSettings: TSettings) => TSettings;
  updateSettings: <TSettings>(
    panelId: string,
    defaultSettings: TSettings,
    updater: (current: TSettings) => TSettings,
  ) => void;
}

const DashboardPanelSettingsContext = createContext<DashboardPanelSettingsContextValue>({
  getSettings: <TSettings,>(_panelId: string, defaultSettings: TSettings) => defaultSettings,
  updateSettings: () => {},
});

export const useDashboardGridActions = (): DashboardGridActions => {
  return useContext(DashboardGridActionsContext);
};

export const useDashboardPanelSettings = <TSettings,>(
  panelId: string,
  defaultSettings: TSettings,
): readonly [TSettings, (updater: (current: TSettings) => TSettings) => void] => {
  const context = useContext(DashboardPanelSettingsContext);
  const settings = context.getSettings(panelId, defaultSettings);

  return [
    settings,
    (updater) => {
      context.updateSettings(panelId, defaultSettings, updater);
    },
  ] as const;
};

const getChildPanelId = (child: ReactNode): string | null => {
  if (!child || typeof child !== 'object' || !('props' in child)) {
    return null;
  }

  const props = child.props as { panelId?: unknown };
  if (typeof props.panelId === 'string') {
    return props.panelId;
  }

  const key = (child as { key?: unknown }).key;
  if (typeof key !== 'string') {
    return null;
  }

  return key.replace(/^\.\$/, '');
};

const getHoveredDashboardPanelId = (root: ParentNode | null): string | null => {
  if (!root) {
    return null;
  }

  const hoveredPanels = Array.from(root.querySelectorAll<HTMLElement>(`${DASHBOARD_PANEL_SELECTOR}:hover`));
  const hoveredPanel = hoveredPanels[hoveredPanels.length - 1];

  return hoveredPanel?.dataset.dashboardPanelId ?? null;
};

const normalizeGridChildKey = (child: ReactNode, panelId: string): ReactNode => {
  if (!isValidElement(child)) {
    return child;
  }

  return cloneElement(child, { key: panelId });
};

const clonePanelSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
  return structuredClone(settings);
};

const clonePanelElements = (elements: Record<string, PanelKind>): Record<string, PanelKind> => {
  return structuredClone(elements);
};

const sortSerializable = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => [key, sortSerializable(item)]),
  );
};

const isPlainSettingsObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const mergeDefaultSettings = <TSettings,>(defaultSettings: TSettings, override: unknown): TSettings => {
  if (isPlainSettingsObject(defaultSettings) && isPlainSettingsObject(override)) {
    return {
      ...defaultSettings,
      ...override,
    } as TSettings;
  }

  return (override ?? defaultSettings) as TSettings;
};

const serializeSettings = (value: unknown): string => {
  return JSON.stringify(sortSerializable(value));
};

const cloneTimeSettings = (timeSettings: DashboardTimeSettingsKind): DashboardTimeSettingsKind => {
  return {
    autoRefresh: timeSettings.autoRefresh,
    autoRefreshIntervals: [...timeSettings.autoRefreshIntervals],
  };
};

const normalizeLayoutNumber = (value: number, fallback: number): number => {
  return Number.isFinite(value) ? Math.round(value) : fallback;
};

const clampLayoutNumber = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const normalizeDashboardPanelLayoutState = (layout: DashboardPanelLayoutState): DashboardPanelLayoutState => {
  const width = Math.min(
    gridConfig.cols,
    Math.max(1, normalizeLayoutNumber(layout.width, 1)),
  );
  const height = Math.max(1, normalizeLayoutNumber(layout.height, 1));
  const maxX = Math.max(0, gridConfig.cols - width);

  return {
    x: Math.min(maxX, Math.max(0, normalizeLayoutNumber(layout.x, 0))),
    y: Math.max(0, normalizeLayoutNumber(layout.y, 0)),
    width,
    height,
  };
};

const getGridColumnWidth = (containerWidth: number): number => {
  return (
    containerWidth -
    gridConfig.margin[0] * (gridConfig.cols - 1) -
    gridConfig.containerPadding[0] * 2
  ) / gridConfig.cols;
};

const gridWidthToPixels = (gridWidth: number, columnWidth: number): number => {
  return columnWidth * gridWidth + Math.max(0, gridWidth - 1) * gridConfig.margin[0];
};

const gridHeightToPixels = (gridHeight: number): number => {
  return gridConfig.rowHeight * gridHeight + Math.max(0, gridHeight - 1) * gridConfig.margin[1];
};

const pixelsToGridWidth = (pixelWidth: number, columnWidth: number): number => {
  return Math.round((pixelWidth + gridConfig.margin[0]) / (columnWidth + gridConfig.margin[0]));
};

const pixelsToGridHeight = (pixelHeight: number): number => {
  return Math.round((pixelHeight + gridConfig.margin[1]) / (gridConfig.rowHeight + gridConfig.margin[1]));
};

const getAspectRatioLayoutState = (
  current: DashboardPanelLayoutState,
  options: DashboardPanelAspectRatioLayoutOptions,
  containerWidth: number,
): DashboardPanelLayoutState => {
  const normalizedCurrent = normalizeDashboardPanelLayoutState(current);
  const columnWidth = getGridColumnWidth(containerWidth);

  if (!Number.isFinite(columnWidth) || columnWidth <= 0 || !Number.isFinite(options.aspectRatio) || options.aspectRatio <= 0) {
    return normalizedCurrent;
  }

  const minWidth = clampLayoutNumber(options.minWidth ?? 1, 1, gridConfig.cols);
  const maxWidth = clampLayoutNumber(options.maxWidth ?? gridConfig.cols, minWidth, gridConfig.cols);
  const minHeight = Math.max(1, normalizeLayoutNumber(options.minHeight ?? 1, 1));
  const maxHeight = Math.max(minHeight, normalizeLayoutNumber(options.maxHeight ?? Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY));
  const currentPixelWidth = gridWidthToPixels(normalizedCurrent.width, columnWidth);
  const currentPixelHeight = gridHeightToPixels(normalizedCurrent.height);
  const targetArea = currentPixelWidth * currentPixelHeight;
  const targetPixelWidth = Math.sqrt(targetArea * options.aspectRatio);
  const targetPixelHeight = targetPixelWidth / options.aspectRatio;
  const nextWidth = clampLayoutNumber(
    pixelsToGridWidth(targetPixelWidth, columnWidth),
    minWidth,
    maxWidth,
  );
  const nextHeight = clampLayoutNumber(
    pixelsToGridHeight(targetPixelHeight),
    minHeight,
    maxHeight,
  );

  return normalizeDashboardPanelLayoutState({
    ...normalizedCurrent,
    width: nextWidth,
    height: nextHeight,
  });
};

const getGridHeightForAspectRatio = (
  gridWidth: number,
  aspectRatio: number,
  containerWidth: number,
  fallbackHeight: number,
): number => {
  const columnWidth = getGridColumnWidth(containerWidth);

  if (!Number.isFinite(columnWidth) || columnWidth <= 0 || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return fallbackHeight;
  }

  const pixelWidth = gridWidthToPixels(gridWidth, columnWidth);
  return Math.max(1, pixelsToGridHeight(pixelWidth / aspectRatio));
};

const serializeLayout = (layout: Layout): string => {
  return JSON.stringify(
    layout
      .map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      }))
      .sort((left, right) => left.i.localeCompare(right.i)),
  );
};

const serializeElements = (elements: Record<string, PanelKind>): string => {
  return JSON.stringify(sortSerializable(elements));
};

const getPanelSettingsRegistration = (
  settingsRegistry: DashboardPanelSettingsRegistry,
  panel: PanelKind,
): DashboardPanelSettingsRegistration | undefined => {
  return settingsRegistry[panel.spec.vizConfig.group];
};

const getPanelSettingsEntries = (
  settingsRegistry: DashboardPanelSettingsRegistry,
  elements: Record<string, PanelKind>,
): Array<[string, DashboardPanelSettingsRegistration]> => {
  return Object.entries(elements)
    .map(([panelId, panel]) => {
      const registration = getPanelSettingsRegistration(settingsRegistry, panel);
      return registration ? [panelId, registration] as const : null;
    })
    .filter((entry): entry is [string, DashboardPanelSettingsRegistration] => Boolean(entry));
};

const buildEffectivePanelSettings = (
  settingsRegistry: DashboardPanelSettingsRegistry,
  elements: Record<string, PanelKind>,
  persistedPanelSettings: Record<string, unknown>,
  runtimePanelSettings: Record<string, unknown>,
): Record<string, unknown> => {
  return Object.fromEntries(
    getPanelSettingsEntries(settingsRegistry, elements).map(([panelId, registration]) => [
      panelId,
      mergeDefaultSettings(
        registration.defaultSettings,
        runtimePanelSettings[panelId] ?? persistedPanelSettings[panelId],
      ),
    ]),
  );
};

const getNextAddedPanelId = (
  entry: DashboardPanelCatalogEntry,
  elements: Record<string, PanelKind>,
): string => {
  if (!allowsMultiplePanelInstances(entry) || !elements[entry.elementName]) {
    return entry.elementName;
  }

  let nextIndex = 2;
  let nextPanelId = `${entry.elementName}-${nextIndex}`;

  while (elements[nextPanelId]) {
    nextIndex += 1;
    nextPanelId = `${entry.elementName}-${nextIndex}`;
  }

  return nextPanelId;
};

const getNextAddedPanelNumericId = (elements: Record<string, PanelKind>): number => {
  const existingIds = Object.values(elements)
    .map((element) => element.spec.id)
    .filter((id) => Number.isFinite(id));

  return existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
};

const groupPanelCatalogEntries = (entries: DashboardPanelCatalogEntry[]) => {
  const grouped = new Map<string, DashboardPanelCatalogEntry[]>();
  const topLevel: DashboardPanelCatalogEntry[] = [];

  for (const entry of entries) {
    if (!entry.category) {
      topLevel.push(entry);
      continue;
    }

    const groupedEntries = grouped.get(entry.category.label) ?? [];
    groupedEntries.push(entry);
    grouped.set(entry.category.label, groupedEntries);
  }

  return {
    groups: [...grouped.entries()].map(([label, entries]) => ({ label, entries })),
    topLevel,
  };
};

const AddPanelOption = ({
  entry,
  onAddPanel,
}: {
  entry: DashboardPanelCatalogEntry;
  onAddPanel: (entry: DashboardPanelCatalogEntry) => void;
}) => (
  <button
    type="button"
    className="ui_caption rounded-[4px] border border-border px-3 py-2 text-left text-text-soft transition-colors hover:bg-surface-muted hover:text-text"
    onClick={() => onAddPanel(entry)}
  >
    {entry.title}
  </button>
);

export const DashboardGrid = ({
  layout,
  children,
  dashboardType,
  isOwner = false,
  viewedPanelId: controlledViewedPanelId,
  onViewedPanelChange,
  editedPanelId: controlledEditedPanelId,
  onEditedPanelChange,
  settingsRegistry = {},
  initialElements = EMPTY_PANEL_ELEMENTS,
  renderPanel,
  panelCatalogEntries = [],
  initialPanelSettings = EMPTY_PANEL_SETTINGS,
  initialTimeSettings,
  currentTimeSettings = initialTimeSettings,
  onDiscardTimeSettings,
  editControlsPortalId,
  onUnauthorizedSaveDashboard,
  onSaveDashboard,
  onDeleteDashboard,
}: DashboardGridProps): ReactElement => {
  const initialLayout = useMemo(() => toReactGridLayoutItems(layout.spec.items), [layout]);
  const [persistedLayout, setPersistedLayout] = useState<Layout>(() => cloneReactGridLayoutItems(initialLayout));
  const [runtimeLayout, setRuntimeLayout] = useState<Layout>(() => cloneReactGridLayoutItems(initialLayout));
  const [uncontrolledViewedPanelId, setUncontrolledViewedPanelId] = useState<string | null>(null);
  const [editedPanel, setEditedPanel] = useState<{ panelId: string; title: string } | null>(null);
  const [isAddPanelDrawerOpen, setIsAddPanelDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [persistedPanelSettings, setPersistedPanelSettings] = useState<Record<string, unknown>>(
    () => clonePanelSettings(initialPanelSettings),
  );
  const [persistedElements, setPersistedElements] = useState<Record<string, PanelKind>>(
    () => clonePanelElements(initialElements),
  );
  const [runtimeElements, setRuntimeElements] = useState<Record<string, PanelKind>>(
    () => clonePanelElements(initialElements),
  );
  const [persistedTimeSettings, setPersistedTimeSettings] = useState<DashboardTimeSettingsKind | undefined>(
    () => initialTimeSettings ? cloneTimeSettings(initialTimeSettings) : undefined,
  );
  const [runtimePanelSettings, setRuntimePanelSettings] = useState<Record<string, unknown>>({});
  const [isSavingDashboard, setIsSavingDashboard] = useState(false);
  const [isDeletingDashboard, setIsDeletingDashboard] = useState(false);
  const [moveAnimationsEnabled, setMoveAnimationsEnabled] = useState(false);
  const [editControlsPortalTarget, setEditControlsPortalTarget] = useState<HTMLElement | null>(null);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [soloPanelMaxRows, setSoloPanelMaxRows] = useState<number | null>(null);
  const [gridViewportElement, setGridViewportElement] = useState<HTMLDivElement | null>(null);
  const initialPanelSettingsSnapshotRef = useRef<string | null>(null);
  const [pendingDiscardAction, setPendingDiscardAction] = useState<
    | { type: 'exit-edit-mode' }
    | { type: 'view-panel'; panelId: string; navigationMode: 'push' | 'replace' }
    | { type: 'navigate'; href: string }
    | null
  >(null);
  const { containerRef, measureWidth, mounted, width } = useContainerWidth({ measureBeforeMount: true });
  const isDraggable = mounted && width > 768;
  const viewedPanelId = controlledViewedPanelId ?? uncontrolledViewedPanelId;
  const isLayoutEditingEnabled = isEditMode && isDraggable && !viewedPanelId;
  const availablePanelCatalogEntries = useMemo(() => {
    if (!dashboardType || !isOwner) {
      return [];
    }

    const currentGroups = new Set(
      Object.values(runtimeElements).map((element) => element.spec.vizConfig.group),
    );

    return panelCatalogEntries.filter((entry) => (
      entry.compatibleDashboardTypes.includes(dashboardType) &&
      (allowsMultiplePanelInstances(entry) || !currentGroups.has(entry.group))
    ));
  }, [dashboardType, isOwner, panelCatalogEntries, runtimeElements]);
  const groupedPanelCatalogEntries = useMemo(
    () => groupPanelCatalogEntries(availablePanelCatalogEntries),
    [availablePanelCatalogEntries],
  );
  const visibleChildren = useMemo(() => {
    const childItems = Children.toArray(children);
    const childrenByPanelId = new Map<string, ReactNode>();
    for (const child of childItems) {
      const panelId = getChildPanelId(child);
      if (panelId) {
        childrenByPanelId.set(panelId, child);
      }
    }
    const visiblePanelIds = viewedPanelId
      ? [viewedPanelId]
      : runtimeLayout.map((item) => item.i);

    return visiblePanelIds
      .map((panelId) => {
        const existingChild = childrenByPanelId.get(panelId);
        if (existingChild) {
          return normalizeGridChildKey(existingChild, panelId);
        }

        const panel = runtimeElements[panelId];
        const renderedPanel = panel && renderPanel ? renderPanel(panelId, panel) : null;
        return renderedPanel ? normalizeGridChildKey(renderedPanel, panelId) : null;
      })
      .filter((child): child is ReactNode => Boolean(child));
  }, [children, renderPanel, runtimeElements, runtimeLayout, viewedPanelId]);
  const visibleLayout = useMemo(() => {
    if (!viewedPanelId) {
      return runtimeLayout;
    }

    const item = runtimeLayout.find((layoutItem) => layoutItem.i === viewedPanelId);
    if (!item) {
      return runtimeLayout;
    }

    const fullDashboardHeight = runtimeLayout.reduce(
      (maxHeight, layoutItem) => Math.max(maxHeight, layoutItem.y + layoutItem.h),
      item.h,
    );
    const cappedHeight = soloPanelMaxRows
      ? Math.min(fullDashboardHeight, soloPanelMaxRows)
      : fullDashboardHeight;

    return [{ ...item, x: 0, y: 0, w: gridConfig.cols, h: cappedHeight }];
  }, [runtimeLayout, soloPanelMaxRows, viewedPanelId]);

  const handleGridViewportRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setGridViewportElement(node);
  }, [containerRef]);

  useLayoutEffect(() => {
    if (!mounted) {
      return;
    }

    measureWidth();
  }, [editedPanel, measureWidth, mounted]);

  useEffect(() => {
    const nextLayout = cloneReactGridLayoutItems(initialLayout);
    setPersistedLayout(nextLayout);
    setRuntimeLayout(cloneReactGridLayoutItems(nextLayout));
    setPersistedElements(clonePanelElements(initialElements));
    setRuntimeElements(clonePanelElements(initialElements));
    setIsEditMode(false);
    setIsAddPanelDrawerOpen(false);
    setPendingDiscardAction(null);
  }, [initialElements, initialLayout]);

  useEffect(() => {
    const nextSnapshot = serializeSettings(initialPanelSettings);
    if (initialPanelSettingsSnapshotRef.current === nextSnapshot) {
      return;
    }

    initialPanelSettingsSnapshotRef.current = nextSnapshot;
    setPersistedPanelSettings(clonePanelSettings(initialPanelSettings));
    setRuntimePanelSettings({});
  }, [initialPanelSettings]);

  useEffect(() => {
    setPersistedTimeSettings(initialTimeSettings ? cloneTimeSettings(initialTimeSettings) : undefined);
  }, [initialTimeSettings]);

  const settingsContextValue = useMemo<DashboardPanelSettingsContextValue>(
    () => ({
      getSettings: <TSettings,>(panelId: string, defaultSettings: TSettings): TSettings => {
        const current = runtimePanelSettings[panelId];
        const persisted = persistedPanelSettings[panelId];
        return mergeDefaultSettings(defaultSettings, current ?? persisted);
      },
      updateSettings: <TSettings,>(
        panelId: string,
        defaultSettings: TSettings,
        updater: (current: TSettings) => TSettings,
      ) => {
        setRuntimePanelSettings((current) => ({
          ...current,
          [panelId]: updater(mergeDefaultSettings(defaultSettings, current[panelId] ?? persistedPanelSettings[panelId])),
        }));
      },
    }),
    [persistedPanelSettings, runtimePanelSettings],
  );

  const effectivePanelSettings = useMemo(
    () => buildEffectivePanelSettings(settingsRegistry, runtimeElements, persistedPanelSettings, runtimePanelSettings),
    [persistedPanelSettings, runtimeElements, runtimePanelSettings, settingsRegistry],
  );
  const hasUnsavedSettings = useMemo(
    () => getPanelSettingsEntries(settingsRegistry, runtimeElements).some(([panelId, registration]) => {
      const currentSettings = effectivePanelSettings[panelId];
      const persistedSettings = mergeDefaultSettings(
        registration.defaultSettings,
        persistedPanelSettings[panelId],
      );

      return serializeSettings(currentSettings) !== serializeSettings(persistedSettings);
    }),
    [effectivePanelSettings, persistedPanelSettings, runtimeElements, settingsRegistry],
  );
  const hasUnsavedLayout = useMemo(
    () => serializeLayout(runtimeLayout) !== serializeLayout(persistedLayout),
    [persistedLayout, runtimeLayout],
  );
  const hasUnsavedElements = useMemo(
    () => serializeElements(runtimeElements) !== serializeElements(persistedElements),
    [persistedElements, runtimeElements],
  );
  const hasUnsavedTimeSettings = useMemo(
    () => Boolean(
      persistedTimeSettings &&
      currentTimeSettings &&
      serializeSettings(currentTimeSettings) !== serializeSettings(persistedTimeSettings),
    ),
    [currentTimeSettings, persistedTimeSettings],
  );
  const hasSaveableDashboardChanges = hasUnsavedLayout || hasUnsavedSettings || hasUnsavedElements || hasUnsavedTimeSettings;
  const hasUnsavedDashboardChanges = hasUnsavedLayout || hasUnsavedSettings || hasUnsavedElements || (isEditMode && hasUnsavedTimeSettings);
  const shouldGuardUnsavedDashboardChanges = isOwner && hasUnsavedDashboardChanges;
  const canAttemptSaveDashboard = Boolean(onSaveDashboard && isEditMode && hasSaveableDashboardChanges && !isSavingDashboard);

  async function handleSaveDashboard() {
    if (!canAttemptSaveDashboard || !onSaveDashboard) {
      return;
    }

    if (!isOwner) {
      onUnauthorizedSaveDashboard?.();
      return;
    }

    setIsSavingDashboard(true);

    try {
      const nextPersistedSettings = clonePanelSettings(effectivePanelSettings);
      const nextPersistedLayout = cloneReactGridLayoutItems(runtimeLayout);
      const nextPersistedElements = clonePanelElements(runtimeElements);
      const saveInput: {
        panelSettings: Record<string, unknown>;
        layout: Layout;
        elements?: Record<string, PanelKind>;
        timeSettings?: DashboardTimeSettingsKind;
      } = {
        panelSettings: nextPersistedSettings,
        layout: nextPersistedLayout,
      };

      if (hasUnsavedElements) {
        saveInput.elements = nextPersistedElements;
      }

      if (currentTimeSettings) {
        saveInput.timeSettings = cloneTimeSettings(currentTimeSettings);
      }

      await onSaveDashboard(saveInput);
      setPersistedLayout(nextPersistedLayout);
      setPersistedElements(nextPersistedElements);
      setPersistedPanelSettings(nextPersistedSettings);
      if (currentTimeSettings) {
        setPersistedTimeSettings(cloneTimeSettings(currentTimeSettings));
      }
      setRuntimePanelSettings({});
      setPendingDiscardAction(null);
    } catch {
      return;
    } finally {
      setIsSavingDashboard(false);
    }
  }

  async function handleDeleteDashboard() {
    if (!isOwner || !onDeleteDashboard || isDeletingDashboard) {
      return;
    }

    setIsDeletingDashboard(true);
    try {
      await onDeleteDashboard();
    } catch {
      return;
    } finally {
      setIsDeletingDashboard(false);
    }
  }

  const resetRuntimeDashboardState = useCallback(() => {
    setRuntimeLayout(cloneReactGridLayoutItems(persistedLayout));
    setRuntimeElements(clonePanelElements(persistedElements));
    setRuntimePanelSettings({});
    if (persistedTimeSettings) {
      onDiscardTimeSettings?.(cloneTimeSettings(persistedTimeSettings));
    }
  }, [onDiscardTimeSettings, persistedElements, persistedLayout, persistedTimeSettings]);

  const updatePanelLayout = useCallback((
    panelId: string,
    updater: (current: DashboardPanelLayoutState) => DashboardPanelLayoutState,
  ) => {
    setRuntimeLayout((current) => {
      let didUpdate = false;
      const nextLayout = current.map((item) => {
        if (item.i !== panelId) {
          return item;
        }

        didUpdate = true;
        const nextItem = normalizeDashboardPanelLayoutState(updater({
          x: item.x,
          y: item.y,
          width: item.w,
          height: item.h,
        }));

        return {
          ...item,
          x: nextItem.x,
          y: nextItem.y,
          w: nextItem.width,
          h: nextItem.height,
        };
      });

      return didUpdate ? nextLayout : current;
    });
  }, []);

  const resizePanelLayoutToAspectRatio = useCallback((
    panelId: string,
    options: DashboardPanelAspectRatioLayoutOptions,
  ) => {
    if (!isDraggable) {
      return;
    }

    updatePanelLayout(panelId, (current) => getAspectRatioLayoutState(current, options, width));
  }, [isDraggable, updatePanelLayout, width]);

  function handleAddPanel(entry: DashboardPanelCatalogEntry) {
    const nextPanelId = getNextAddedPanelId(entry, runtimeElements);
    const nextWidth = Math.min(gridConfig.cols, entry.defaultLayout.width);
    const nextHeight = getGridHeightForAspectRatio(
      nextWidth,
      entry.defaultLayout.aspectRatio ?? DEFAULT_ADDED_PANEL_ASPECT_RATIO,
      width,
      entry.defaultLayout.height,
    );

    const nextPanel = structuredClone(entry.defaultDefinition);
    nextPanel.spec.id = getNextAddedPanelNumericId(runtimeElements);

    setRuntimeElements((current) => ({
      ...current,
      [nextPanelId]: nextPanel,
    }));
    setRuntimeLayout((current) => [
      {
        i: nextPanelId,
        x: 0,
        y: 0,
        w: nextWidth,
        h: nextHeight,
      },
      ...current.map((item) => ({
        ...item,
        y: item.y + nextHeight,
      })),
    ]);
    setIsAddPanelDrawerOpen(false);
  }

  function handleRemovePanel(panelId: string) {
    setRuntimeElements((current) => {
      const next = { ...current };
      delete next[panelId];
      return next;
    });
    setRuntimeLayout((current) => current.filter((item) => item.i !== panelId));
    setRuntimePanelSettings((current) => {
      const next = { ...current };
      delete next[panelId];
      return next;
    });
    if (editedPanel?.panelId === panelId) {
      setEditedPanel(null);
      commitEditedPanelChange(null, 'replace');
    }
    if (viewedPanelId === panelId) {
      commitViewedPanelChange(null, 'replace');
    }
  }

  const commitViewedPanelChange = useCallback((panelId: string | null, navigationMode: 'push' | 'replace' = 'replace') => {
    if (controlledViewedPanelId === undefined) {
      setUncontrolledViewedPanelId(panelId);
    }

    onViewedPanelChange?.(panelId, navigationMode);
  }, [controlledViewedPanelId, onViewedPanelChange]);

  const commitEditedPanelChange = useCallback((panelId: string | null, navigationMode: 'push' | 'replace' = 'replace') => {
    if (onEditedPanelChange) {
      onEditedPanelChange(panelId, navigationMode);
      return;
    }

    commitViewedPanelChange(panelId, navigationMode);
  }, [commitViewedPanelChange, onEditedPanelChange]);

  const getPanelTitle = useCallback((panelId: string): string => {
    const panel = runtimeElements[panelId];
    if (panel?.spec.title) {
      return panel.spec.title;
    }

    for (const child of Children.toArray(children)) {
      if (getChildPanelId(child) !== panelId || !isValidElement(child)) {
        continue;
      }

      const title = (child.props as { title?: unknown }).title;
      if (typeof title === 'string' && title.length > 0) {
        return title;
      }
    }

    return panelId;
  }, [children, runtimeElements]);

  const enterPanelEditMode = useCallback((
    panel: { panelId: string; title: string },
    navigationMode: 'push' | 'replace' = 'push',
  ) => {
    setEditedPanel(panel);
    setIsAddPanelDrawerOpen(false);
    setIsEditMode(true);
    commitEditedPanelChange(panel.panelId, navigationMode);
  }, [commitEditedPanelChange]);

  const exitPanelEditMode = useCallback((navigationMode: 'push' | 'replace' = 'replace') => {
    setEditedPanel(null);
    setIsEditMode(false);
    setIsAddPanelDrawerOpen(false);
    commitEditedPanelChange(null, navigationMode);
  }, [commitEditedPanelChange]);

  const handleViewedPanelChange = useCallback((panelId: string | null, navigationMode: 'push' | 'replace' = 'replace') => {
    if (panelId) {
      if (isEditMode && shouldGuardUnsavedDashboardChanges) {
        setPendingDiscardAction({ type: 'view-panel', panelId, navigationMode });
        return;
      }

      if (isEditMode && hasUnsavedDashboardChanges) {
        resetRuntimeDashboardState();
      }

      setEditedPanel(null);
      setIsEditMode(false);
    }

    if (!panelId && editedPanel) {
      if (shouldGuardUnsavedDashboardChanges) {
        setPendingDiscardAction({ type: 'exit-edit-mode' });
        return;
      }

      if (hasUnsavedDashboardChanges) {
        resetRuntimeDashboardState();
      }

      exitPanelEditMode('replace');
      return;
    }

    commitViewedPanelChange(panelId, navigationMode);
  }, [
    commitViewedPanelChange,
    editedPanel,
    exitPanelEditMode,
    hasUnsavedDashboardChanges,
    isEditMode,
    resetRuntimeDashboardState,
    shouldGuardUnsavedDashboardChanges,
  ]);

  useEffect(() => {
    if (controlledEditedPanelId === undefined) {
      return;
    }

    if (!controlledEditedPanelId) {
      if (editedPanel) {
        setEditedPanel(null);
        setIsEditMode(false);
        setIsAddPanelDrawerOpen(false);
      }
      return;
    }

    const nextTitle = getPanelTitle(controlledEditedPanelId);
    if (editedPanel?.panelId === controlledEditedPanelId && editedPanel.title === nextTitle && isEditMode) {
      return;
    }

    setEditedPanel({
      panelId: controlledEditedPanelId,
      title: nextTitle,
    });
    setIsAddPanelDrawerOpen(false);
    setIsEditMode(true);
  }, [controlledEditedPanelId, editedPanel, getPanelTitle, isEditMode]);

  const handleExitEditMode = useCallback(() => {
    if (shouldGuardUnsavedDashboardChanges) {
      setPendingDiscardAction({ type: 'exit-edit-mode' });
      return;
    }

    if (hasUnsavedDashboardChanges) {
      resetRuntimeDashboardState();
    }

    setIsEditMode(false);
    if (editedPanel) {
      commitEditedPanelChange(null, 'replace');
    }
    setEditedPanel(null);
    setIsAddPanelDrawerOpen(false);
  }, [
    commitEditedPanelChange,
    editedPanel,
    hasUnsavedDashboardChanges,
    resetRuntimeDashboardState,
    shouldGuardUnsavedDashboardChanges,
  ]);

  function handleDiscardChanges() {
    const nextAction = pendingDiscardAction;

    resetRuntimeDashboardState();
    setPendingDiscardAction(null);

    if (!nextAction) {
      return;
    }

    if (nextAction.type === 'exit-edit-mode') {
      if (editedPanel) {
        commitEditedPanelChange(null, 'replace');
      }
      setEditedPanel(null);
      setIsEditMode(false);
      return;
    }

    if (nextAction.type === 'view-panel') {
      setEditedPanel(null);
      setIsEditMode(false);
      commitViewedPanelChange(nextAction.panelId, nextAction.navigationMode);
      return;
    }

    window.location.assign(nextAction.href);
  }

  const editedPanelKind = editedPanel ? runtimeElements[editedPanel.panelId] : undefined;
  const editedPanelRegistration = editedPanelKind
    ? getPanelSettingsRegistration(settingsRegistry, editedPanelKind)
    : undefined;
  const editedPanelSettings = editedPanel && editedPanelRegistration
    ? settingsContextValue.getSettings(editedPanel.panelId, editedPanelRegistration.defaultSettings)
    : undefined;

  useEffect(() => {
    setMoveAnimationsEnabled(false);

    if (!mounted || !isDraggable) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMoveAnimationsEnabled(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isDraggable, mounted]);

  useEffect(() => {
    if (!mounted || !gridViewportElement || hoveredPanelId) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const nextHoveredPanelId = getHoveredDashboardPanelId(gridViewportElement);
      if (nextHoveredPanelId) {
        setHoveredPanelId(nextHoveredPanelId);
      }
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [gridViewportElement, hoveredPanelId, mounted, visibleLayout]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      const editable = target.closest('input, textarea, select, [contenteditable="true"]');
      return editable instanceof HTMLElement;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key !== 'v' && key !== 'e') {
        return;
      }

      const activePanelId = hoveredPanelId ?? getHoveredDashboardPanelId(gridViewportElement) ?? viewedPanelId;
      if (!activePanelId) {
        return;
      }

      if (key === 'e') {
        if (editedPanel?.panelId === activePanelId) {
          handleExitEditMode();
          return;
        }

        enterPanelEditMode({
          panelId: activePanelId,
          title: getPanelTitle(activePanelId),
        }, viewedPanelId === activePanelId ? 'replace' : 'push');
        return;
      }

      if (editedPanel) {
        handleViewedPanelChange(activePanelId, viewedPanelId === activePanelId ? 'replace' : 'push');
        return;
      }

      if (viewedPanelId === activePanelId) {
        handleViewedPanelChange(null, 'replace');
        return;
      }

      handleViewedPanelChange(activePanelId, 'push');
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enterPanelEditMode,
    editedPanel,
    getPanelTitle,
    gridViewportElement,
    handleExitEditMode,
    handleViewedPanelChange,
    hoveredPanelId,
    viewedPanelId,
  ]);

  useEffect(() => {
    if (!viewedPanelId || !mounted) {
      setSoloPanelMaxRows(null);
      return;
    }

    function updateSoloPanelMaxRows() {
      const top = gridViewportElement?.getBoundingClientRect().top;

      if (typeof top !== 'number' || !Number.isFinite(top)) {
        setSoloPanelMaxRows(null);
        return;
      }

      const shell = gridViewportElement?.closest('main');
      const shellPaddingBottom = shell ? Number.parseFloat(window.getComputedStyle(shell).paddingBottom) || 0 : 0;
      const availableHeight = Math.max(
        gridConfig.rowHeight,
        window.innerHeight - Math.max(0, Math.ceil(top)) - Math.ceil(shellPaddingBottom),
      );
      const verticalMargin = gridConfig.margin[1];
      const rowHeightWithMargin = gridConfig.rowHeight + verticalMargin;
      const maxRows = Math.max(1, Math.floor((availableHeight + verticalMargin) / rowHeightWithMargin));

      setSoloPanelMaxRows(maxRows);
    }

    updateSoloPanelMaxRows();
    window.addEventListener('resize', updateSoloPanelMaxRows);

    return () => {
      window.removeEventListener('resize', updateSoloPanelMaxRows);
    };
  }, [gridViewportElement, mounted, viewedPanelId, width]);

  useEffect(() => {
    if (!shouldGuardUnsavedDashboardChanges) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.href === window.location.href) {
        return;
      }

      event.preventDefault();
      setPendingDiscardAction({ type: 'navigate', href: nextUrl.href });
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [shouldGuardUnsavedDashboardChanges]);

  useEffect(() => {
    if (!editControlsPortalId) {
      setEditControlsPortalTarget(null);
      return;
    }

    setEditControlsPortalTarget(document.getElementById(editControlsPortalId));
  }, [editControlsPortalId]);

  const dashboardEditControls = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {viewedPanelId ? (
        <Button
          aria-label="to dashboard"
          twStyles={DASHBOARD_EDIT_BUTTON_STYLES}
          onClick={() => handleViewedPanelChange(null, 'replace')}
        >
          <Icon icon="chevron-left" size="h-3.5 w-3.5" />
          <span>to dashboard</span>
        </Button>
      ) : null}
      {viewedPanelId ? null : isEditMode ? (
        <>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <Button
                aria-label="Add panel"
                twStyles={DASHBOARD_EDIT_BUTTON_STYLES}
                onClick={() => setIsAddPanelDrawerOpen(true)}
              >
                <span>Add panel</span>
              </Button>
            ) : null}
            <Button
              aria-label="Save dashboard"
              twStyles={DASHBOARD_EDIT_BUTTON_STYLES}
              disabled={!canAttemptSaveDashboard}
              onClick={handleSaveDashboard}
            >
              {isSavingDashboard ? 'Saving' : 'Save'}
            </Button>
            {isOwner && onDeleteDashboard ? (
              <Button
                aria-label="Delete dashboard"
                twStyles={DASHBOARD_EDIT_BUTTON_STYLES}
                disabled={isDeletingDashboard}
                onClick={handleDeleteDashboard}
              >
                {isDeletingDashboard ? 'Deleting' : 'Delete dashboard'}
              </Button>
            ) : null}
            <Button
              aria-label="Exit dashboard edit mode"
              twStyles={DASHBOARD_EDIT_BUTTON_STYLES}
              onClick={handleExitEditMode}
            >
              Close
            </Button>
          </div>
          {!isOwner ? (
            <p className="body_text text-left text-text-soft">
              Admin sign in is required to save dashboard settings.
            </p>
          ) : null}
        </>
      ) : (
        <Button
          aria-label="Edit dashboard"
          twStyles={DASHBOARD_EDIT_BUTTON_STYLES}
          onClick={() => {
            setIsEditMode(true);
          }}
        >
          <Icon icon="edit" size="h-3.5 w-3.5" />
          <span>Edit</span>
        </Button>
      )}
    </div>
  );
  const shouldRenderInternalControls = !editControlsPortalId;
  const panelSettingsDrawer = editedPanel ? (
    <aside
      aria-label={`Panel settings for ${editedPanel.title}`}
      role="complementary"
      className="dashboard-panel-settings-drawer fixed right-0 top-0 z-50 flex h-screen w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden border-l border-dashboard-settings-drawer-border bg-dashboard-settings-drawer-bg shadow-2xl"
    >
      <div className="dashboard-panel-settings-drawer-header flex shrink-0 items-start justify-between gap-4 border-b border-dashboard-settings-drawer-border bg-dashboard-settings-drawer-header-bg px-6 py-5">
        <h2 className="panel_title text-text">{editedPanel.title} settings</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ui_caption rounded-[4px] border border-border px-3 py-1 text-text-soft disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canAttemptSaveDashboard}
            onClick={handleSaveDashboard}
          >
            {isSavingDashboard ? 'Saving' : 'Save'}
          </button>
          <button
            type="button"
            className="ui_caption rounded-[4px] border border-border px-2 py-1 text-text-soft"
            onClick={() => exitPanelEditMode('replace')}
          >
            Close
          </button>
        </div>
      </div>
      <div
        data-testid="dashboard-panel-settings-scroll-region"
        className="dashboard-panel-settings-scroll-region flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6"
      >
        <div className="flex-1">
          {editedPanelRegistration && editedPanelSettings !== undefined ? (
            editedPanelRegistration.render({
              settings: editedPanelSettings,
              updateSettings: (updater) => {
                settingsContextValue.updateSettings(
                  editedPanel.panelId,
                  editedPanelRegistration.defaultSettings,
                  updater,
                );
              },
              updateLayout: (updater) => {
                updatePanelLayout(editedPanel.panelId, updater);
              },
              resizeLayoutToAspectRatio: (options) => {
                resizePanelLayoutToAspectRatio(editedPanel.panelId, options);
              },
              isOwner,
            })
          ) : (
            <p className="body_text text-text-soft">No settings available yet.</p>
          )}
        </div>
        {!isOwner ? (
          <p className="body_text mt-6 border-t border-border pt-4 text-text-soft">
            Admin sign in is required to save dashboard settings.
          </p>
        ) : null}
      </div>
    </aside>
  ) : null;

  return (
    <DashboardGridActionsContext.Provider
      value={{
        viewPanel: (panelId) => handleViewedPanelChange(panelId, 'push'),
        editPanel: (panel) => enterPanelEditMode(panel, 'push'),
        removePanel: handleRemovePanel,
        setHoveredPanel: setHoveredPanelId,
        hoveredPanelId,
        isOwner,
        isEditMode,
        isLayoutEditingEnabled,
        viewedPanelId,
      }}
    >
      <DashboardPanelSettingsContext.Provider value={settingsContextValue}>
        <div className={['w-full', editedPanel ? 'lg:pr-[25rem]' : ''].filter(Boolean).join(' ')}>
          {editControlsPortalTarget ? createPortal(dashboardEditControls, editControlsPortalTarget) : null}
          {panelSettingsDrawer && typeof document !== 'undefined' ? createPortal(panelSettingsDrawer, document.body) : null}
          {shouldRenderInternalControls ? (
            <div className="mb-4 flex items-start justify-start gap-4">
              {dashboardEditControls}
            </div>
          ) : null}
          <div className="min-h-0 w-full">
            <div ref={handleGridViewportRef} className="min-w-0">
              {mounted ? (
                <ReactGridLayout
                  autoSize
                  className={[
                    'dashboard-grid',
                    isEditMode ? 'dashboard-grid--editing' : '',
                    moveAnimationsEnabled && isEditMode && !viewedPanelId ? 'react-grid-layout--enable-move-animations' : '',
                  ].filter(Boolean).join(' ')}
                  dragConfig={{
                    enabled: isLayoutEditingEnabled,
                    handle: '.dashboard-panel-drag-handle',
                    cancel: '.grid-drag-cancel,button,input,select,textarea,a',
                  }}
                  gridConfig={gridConfig}
                  layout={visibleLayout}
                  resizeConfig={{ enabled: isLayoutEditingEnabled }}
                  width={width}
                  onLayoutChange={(nextLayout) => {
                    if (!isLayoutEditingEnabled) {
                      return;
                    }

                    setRuntimeLayout(cloneReactGridLayoutItems(nextLayout));
                  }}
                >
                  {visibleChildren}
                </ReactGridLayout>
              ) : null}
            </div>
          </div>
          {isAddPanelDrawerOpen ? (
            <aside
              aria-label="Add panel"
              role="complementary"
              className="dashboard-panel-settings-drawer fixed right-0 top-0 z-50 flex h-screen w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden border-l border-dashboard-settings-drawer-border bg-dashboard-settings-drawer-bg shadow-2xl"
            >
              <div className="dashboard-panel-settings-drawer-header flex shrink-0 items-start justify-between gap-4 border-b border-dashboard-settings-drawer-border bg-dashboard-settings-drawer-header-bg px-6 py-5">
                <h2 className="panel_title text-text">Add panel</h2>
                <button
                  type="button"
                  className="ui_caption rounded-[4px] border border-border px-2 py-1 text-text-soft"
                  onClick={() => setIsAddPanelDrawerOpen(false)}
                >
                  Close
                </button>
              </div>
              <div
                data-testid="dashboard-add-panel-scroll-region"
                className="dashboard-panel-settings-scroll-region flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6"
              >
                {availablePanelCatalogEntries.length > 0 ? (
                  <div className="grid auto-rows-max content-start gap-2">
                    {groupedPanelCatalogEntries.groups.map((group) => (
                      <section
                        key={group.label}
                        role="group"
                        aria-label={group.label}
                        className="grid gap-2"
                      >
                        <h3 className="ui_caption text-text">{group.label}</h3>
                        {group.entries.map((entry) => (
                          <AddPanelOption key={entry.group} entry={entry} onAddPanel={handleAddPanel} />
                        ))}
                      </section>
                    ))}
                    {groupedPanelCatalogEntries.topLevel.map((entry) => (
                      <AddPanelOption key={entry.group} entry={entry} onAddPanel={handleAddPanel} />
                    ))}
                  </div>
                ) : (
                  <p className="body_text text-text-soft">No compatible panels available.</p>
                )}
              </div>
            </aside>
          ) : null}
          {pendingDiscardAction ? (
            <DialogPanel title="Discard unsaved dashboard changes?">
              <div className="flex flex-col gap-4">
                <p className="body_text text-text-soft">
                  Your unsaved dashboard changes will be lost.
                </p>
                <div className="flex justify-end gap-2">
                  <SecondaryButton
                    aria-label="Keep editing"
                    onClick={() => setPendingDiscardAction(null)}
                  >
                    Keep editing
                  </SecondaryButton>
                  <SecondaryButton
                    aria-label="Discard changes"
                    onClick={handleDiscardChanges}
                  >
                    Discard changes
                  </SecondaryButton>
                </div>
              </div>
            </DialogPanel>
          ) : null}
        </div>
      </DashboardPanelSettingsContext.Provider>
    </DashboardGridActionsContext.Provider>
  );
};
