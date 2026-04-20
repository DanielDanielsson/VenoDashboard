'use client';

import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactGridLayout, { useContainerWidth, type Layout } from 'react-grid-layout';
import { cloneReactGridLayoutItems, toReactGridLayoutItems } from '@/lib/dashboard/grid-layout';
import type { DashboardTimeSettingsKind, GridLayoutKind } from '@/lib/dashboard/schema';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { DialogPanel } from '@ui/components/DialogPanel';
import { SecondaryButton } from '@ui/components/SecondaryButton';

export interface DashboardPanelSettingsRegistration<TSettings = unknown> {
  defaultSettings: TSettings;
  render: (input: {
    settings: TSettings;
    updateSettings: (updater: (current: TSettings) => TSettings) => void;
    isOwner: boolean;
  }) => ReactNode;
}

export type DashboardPanelSettingsRegistry = Record<string, DashboardPanelSettingsRegistration>;

interface DashboardGridProps {
  layout: GridLayoutKind;
  children: ReactNode;
  isOwner?: boolean;
  settingsRegistry?: DashboardPanelSettingsRegistry;
  initialPanelSettings?: Record<string, unknown>;
  initialTimeSettings?: DashboardTimeSettingsKind;
  currentTimeSettings?: DashboardTimeSettingsKind;
  onDiscardTimeSettings?: (timeSettings: DashboardTimeSettingsKind) => void;
  editControlsPortalId?: string;
  onSaveDashboard?: (input: {
    panelSettings: Record<string, unknown>;
    layout: Layout;
    timeSettings?: DashboardTimeSettingsKind;
  }) => Promise<void>;
}

const gridConfig = {
  cols: 12,
  rowHeight: 32,
  margin: [4, 4] as const,
  containerPadding: [0, 0] as const,
};
const EMPTY_PANEL_SETTINGS: Record<string, unknown> = {};
const DASHBOARD_EDIT_BUTTON_STYLES = 'ui_caption inline-flex h-[38px] items-center gap-2 rounded-[4px] border border-dashboard-time-picker-border bg-dashboard-time-picker-bg px-3 text-dashboard-time-picker-text transition-colors hover:bg-dashboard-time-picker-bg-hover hover:text-dashboard-time-picker-text';

interface DashboardGridActions {
  viewPanel: (panelId: string) => void;
  editPanel: (panel: { panelId: string; title: string }) => void;
  isEditMode: boolean;
  isLayoutEditingEnabled: boolean;
}

const DashboardGridActionsContext = createContext<DashboardGridActions>({
  viewPanel: () => {},
  editPanel: () => {},
  isEditMode: false,
  isLayoutEditingEnabled: false,
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

export function useDashboardGridActions(): DashboardGridActions {
  return useContext(DashboardGridActionsContext);
}

export function useDashboardPanelSettings<TSettings>(
  panelId: string,
  defaultSettings: TSettings,
): readonly [TSettings, (updater: (current: TSettings) => TSettings) => void] {
  const context = useContext(DashboardPanelSettingsContext);
  const settings = context.getSettings(panelId, defaultSettings);

  return [
    settings,
    (updater) => {
      context.updateSettings(panelId, defaultSettings, updater);
    },
  ] as const;
}

function getChildPanelId(child: ReactNode): string | null {
  if (!child || typeof child !== 'object' || !('props' in child)) {
    return null;
  }

  const props = child.props as { panelId?: unknown };
  return typeof props.panelId === 'string' ? props.panelId : null;
}

function clonePanelSettings(settings: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(settings);
}

function sortSerializable(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => [key, sortSerializable(item)]),
  );
}

function isPlainSettingsObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDefaultSettings<TSettings>(defaultSettings: TSettings, override: unknown): TSettings {
  if (isPlainSettingsObject(defaultSettings) && isPlainSettingsObject(override)) {
    return {
      ...defaultSettings,
      ...override,
    } as TSettings;
  }

  return (override ?? defaultSettings) as TSettings;
}

function serializeSettings(value: unknown): string {
  return JSON.stringify(sortSerializable(value));
}

function cloneTimeSettings(timeSettings: DashboardTimeSettingsKind): DashboardTimeSettingsKind {
  return {
    autoRefresh: timeSettings.autoRefresh,
    autoRefreshIntervals: [...timeSettings.autoRefreshIntervals],
  };
}

function serializeLayout(layout: Layout): string {
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
}

function buildEffectivePanelSettings(
  settingsRegistry: DashboardPanelSettingsRegistry,
  persistedPanelSettings: Record<string, unknown>,
  runtimePanelSettings: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(settingsRegistry).map(([panelId, registration]) => [
      panelId,
      mergeDefaultSettings(
        registration.defaultSettings,
        runtimePanelSettings[panelId] ?? persistedPanelSettings[panelId],
      ),
    ]),
  );
}

export function DashboardGrid({
  layout,
  children,
  isOwner = false,
  settingsRegistry = {},
  initialPanelSettings = EMPTY_PANEL_SETTINGS,
  initialTimeSettings,
  currentTimeSettings = initialTimeSettings,
  onDiscardTimeSettings,
  editControlsPortalId,
  onSaveDashboard,
}: DashboardGridProps): ReactElement {
  const initialLayout = useMemo(() => toReactGridLayoutItems(layout.spec.items), [layout]);
  const [persistedLayout, setPersistedLayout] = useState<Layout>(() => cloneReactGridLayoutItems(initialLayout));
  const [runtimeLayout, setRuntimeLayout] = useState<Layout>(() => cloneReactGridLayoutItems(initialLayout));
  const [viewedPanelId, setViewedPanelId] = useState<string | null>(null);
  const [editedPanel, setEditedPanel] = useState<{ panelId: string; title: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [persistedPanelSettings, setPersistedPanelSettings] = useState<Record<string, unknown>>(
    () => clonePanelSettings(initialPanelSettings),
  );
  const [persistedTimeSettings, setPersistedTimeSettings] = useState<DashboardTimeSettingsKind | undefined>(
    () => initialTimeSettings ? cloneTimeSettings(initialTimeSettings) : undefined,
  );
  const [runtimePanelSettings, setRuntimePanelSettings] = useState<Record<string, unknown>>({});
  const [isSavingDashboard, setIsSavingDashboard] = useState(false);
  const [dashboardSaveError, setDashboardSaveError] = useState<string | null>(null);
  const [moveAnimationsEnabled, setMoveAnimationsEnabled] = useState(false);
  const [editControlsPortalTarget, setEditControlsPortalTarget] = useState<HTMLElement | null>(null);
  const [pendingDiscardAction, setPendingDiscardAction] = useState<
    | { type: 'exit-edit-mode' }
    | { type: 'navigate'; href: string }
    | null
  >(null);
  const { containerRef, mounted, width } = useContainerWidth({ measureBeforeMount: true });
  const isDraggable = mounted && width > 768;
  const isLayoutEditingEnabled = isEditMode && isDraggable;
  const visibleChildren = useMemo(() => {
    const childItems = Array.isArray(children) ? children : [children];

    if (!viewedPanelId) {
      return childItems;
    }

    return childItems.filter((child) => getChildPanelId(child) === viewedPanelId);
  }, [children, viewedPanelId]);
  const visibleLayout = useMemo(() => {
    if (!viewedPanelId) {
      return runtimeLayout;
    }

    const item = runtimeLayout.find((layoutItem) => layoutItem.i === viewedPanelId);
    if (!item) {
      return runtimeLayout;
    }

    return [{ ...item, x: 0, y: 0, w: 12 }];
  }, [runtimeLayout, viewedPanelId]);

  useEffect(() => {
    const nextLayout = cloneReactGridLayoutItems(initialLayout);
    setPersistedLayout(nextLayout);
    setRuntimeLayout(cloneReactGridLayoutItems(nextLayout));
    setIsEditMode(false);
    setPendingDiscardAction(null);
  }, [initialLayout]);

  useEffect(() => {
    setPersistedPanelSettings(clonePanelSettings(initialPanelSettings));
    setRuntimePanelSettings({});
    setDashboardSaveError(null);
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
        setDashboardSaveError(null);
      },
    }),
    [persistedPanelSettings, runtimePanelSettings],
  );

  const effectivePanelSettings = useMemo(
    () => buildEffectivePanelSettings(settingsRegistry, persistedPanelSettings, runtimePanelSettings),
    [persistedPanelSettings, runtimePanelSettings, settingsRegistry],
  );
  const hasUnsavedSettings = useMemo(
    () => Object.entries(settingsRegistry).some(([panelId, registration]) => {
      const currentSettings = effectivePanelSettings[panelId];
      const persistedSettings = mergeDefaultSettings(
        registration.defaultSettings,
        persistedPanelSettings[panelId],
      );

      return serializeSettings(currentSettings) !== serializeSettings(persistedSettings);
    }),
    [effectivePanelSettings, persistedPanelSettings, settingsRegistry],
  );
  const hasUnsavedLayout = useMemo(
    () => serializeLayout(runtimeLayout) !== serializeLayout(persistedLayout),
    [persistedLayout, runtimeLayout],
  );
  const hasUnsavedTimeSettings = useMemo(
    () => Boolean(
      persistedTimeSettings &&
      currentTimeSettings &&
      serializeSettings(currentTimeSettings) !== serializeSettings(persistedTimeSettings),
    ),
    [currentTimeSettings, persistedTimeSettings],
  );
  const hasSaveableDashboardChanges = hasUnsavedLayout || hasUnsavedSettings || hasUnsavedTimeSettings;
  const hasUnsavedDashboardChanges = hasUnsavedLayout || hasUnsavedSettings || (isEditMode && hasUnsavedTimeSettings);
  const shouldGuardUnsavedDashboardChanges = isOwner && hasUnsavedDashboardChanges;
  const canSaveDashboard = Boolean(isOwner && onSaveDashboard && isEditMode && hasSaveableDashboardChanges && !isSavingDashboard);

  async function handleSaveDashboard() {
    if (!canSaveDashboard || !onSaveDashboard) {
      return;
    }

    setIsSavingDashboard(true);
    setDashboardSaveError(null);

    try {
      const nextPersistedSettings = clonePanelSettings(effectivePanelSettings);
      const nextPersistedLayout = cloneReactGridLayoutItems(runtimeLayout);
      const saveInput: {
        panelSettings: Record<string, unknown>;
        layout: Layout;
        timeSettings?: DashboardTimeSettingsKind;
      } = {
        panelSettings: nextPersistedSettings,
        layout: nextPersistedLayout,
      };

      if (currentTimeSettings) {
        saveInput.timeSettings = cloneTimeSettings(currentTimeSettings);
      }

      await onSaveDashboard(saveInput);
      setPersistedLayout(nextPersistedLayout);
      setPersistedPanelSettings(nextPersistedSettings);
      if (currentTimeSettings) {
        setPersistedTimeSettings(cloneTimeSettings(currentTimeSettings));
      }
      setRuntimePanelSettings({});
      setPendingDiscardAction(null);
    } catch (error) {
      setDashboardSaveError(error instanceof Error ? error.message : 'Failed to save dashboard settings.');
    } finally {
      setIsSavingDashboard(false);
    }
  }

  function resetRuntimeDashboardState() {
    setRuntimeLayout(cloneReactGridLayoutItems(persistedLayout));
    setRuntimePanelSettings({});
    if (persistedTimeSettings) {
      onDiscardTimeSettings?.(cloneTimeSettings(persistedTimeSettings));
    }
    setDashboardSaveError(null);
  }

  function handleExitEditMode() {
    if (shouldGuardUnsavedDashboardChanges) {
      setPendingDiscardAction({ type: 'exit-edit-mode' });
      return;
    }

    if (hasUnsavedDashboardChanges) {
      resetRuntimeDashboardState();
    }

    setIsEditMode(false);
  }

  function handleDiscardChanges() {
    const nextAction = pendingDiscardAction;

    resetRuntimeDashboardState();
    setPendingDiscardAction(null);

    if (!nextAction) {
      return;
    }

    if (nextAction.type === 'exit-edit-mode') {
      setIsEditMode(false);
      return;
    }

    window.location.assign(nextAction.href);
  }

  const editedPanelRegistration = editedPanel ? settingsRegistry[editedPanel.panelId] : undefined;
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
    if (!shouldGuardUnsavedDashboardChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldGuardUnsavedDashboardChanges]);

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
      {isEditMode ? (
        <>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Save dashboard"
              twStyles={DASHBOARD_EDIT_BUTTON_STYLES}
              disabled={!canSaveDashboard}
              onClick={handleSaveDashboard}
            >
              {isSavingDashboard ? 'Saving' : 'Save'}
            </Button>
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
          {dashboardSaveError ? (
            <p className="body_text text-left text-text-soft">{dashboardSaveError}</p>
          ) : null}
        </>
      ) : (
        <Button
          aria-label="Edit dashboard"
          twStyles={DASHBOARD_EDIT_BUTTON_STYLES}
          onClick={() => {
            setDashboardSaveError(null);
            setIsEditMode(true);
          }}
        >
          <Icon icon="edit" size="h-3.5 w-3.5" />
          <span>Edit</span>
        </Button>
      )}
    </div>
  );
  const shouldRenderInternalControls = Boolean(viewedPanelId || !editControlsPortalId);

  return (
    <DashboardGridActionsContext.Provider
      value={{
        viewPanel: setViewedPanelId,
        editPanel: setEditedPanel,
        isEditMode,
        isLayoutEditingEnabled,
      }}
    >
      <DashboardPanelSettingsContext.Provider value={settingsContextValue}>
        <div ref={containerRef} className="w-full">
          {editControlsPortalTarget ? createPortal(dashboardEditControls, editControlsPortalTarget) : null}
          {shouldRenderInternalControls ? (
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                {viewedPanelId ? (
                  <button
                    type="button"
                    className="ui_caption rounded-[4px] border border-border px-3 py-2 text-text-soft"
                    onClick={() => setViewedPanelId(null)}
                  >
                    Show all dashboard panels
                  </button>
                ) : null}
              </div>
              {!editControlsPortalId ? dashboardEditControls : null}
            </div>
          ) : null}
          {mounted ? (
            <ReactGridLayout
              autoSize
              className={[
                'dashboard-grid',
                isEditMode ? 'dashboard-grid--editing' : '',
                moveAnimationsEnabled ? 'react-grid-layout--enable-move-animations' : '',
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
                if (!isEditMode) {
                  return;
                }

                setRuntimeLayout(cloneReactGridLayoutItems(nextLayout));
              }}
            >
              {visibleChildren}
            </ReactGridLayout>
          ) : null}
          {editedPanel ? (
            <aside
              aria-label={`Panel settings for ${editedPanel.title}`}
              role="complementary"
              className="fixed right-0 top-0 z-50 flex h-screen w-[min(24rem,calc(100vw-2rem))] flex-col border-l border-border bg-bg p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="panel_title text-text">{editedPanel.title} settings</h2>
                <button
                  type="button"
                  className="ui_caption rounded-[4px] border border-border px-2 py-1 text-text-soft"
                  onClick={() => setEditedPanel(null)}
                >
                  Close
                </button>
              </div>
              <div className="flex flex-1 flex-col">
                <div className="mt-6 flex-1">
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
                      isOwner,
                    })
                  ) : (
                    <p className="body_text text-text-soft">No settings available yet.</p>
                  )}
                </div>
                <div className="mt-6 border-t border-border pt-4">
                  <button
                    type="button"
                    className="ui_caption rounded-[4px] border border-border px-3 py-2 text-text-soft disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canSaveDashboard}
                    onClick={handleSaveDashboard}
                  >
                    {isSavingDashboard ? 'Saving' : 'Save'}
                  </button>
                  {!isOwner ? (
                    <p className="body_text mt-3 text-text-soft">
                      Admin sign in is required to save dashboard settings.
                    </p>
                  ) : null}
                  {dashboardSaveError ? (
                    <p className="body_text mt-3 text-text-soft">{dashboardSaveError}</p>
                  ) : null}
                </div>
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
}
