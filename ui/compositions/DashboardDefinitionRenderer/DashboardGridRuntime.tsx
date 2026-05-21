'use client';

import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Layout } from 'react-grid-layout';
import type { DashboardSettingsResponse } from '@/lib/dashboard/settings';
import type { DashboardTimeSettingsKind, DashboardType, GridLayoutKind, PanelKind } from '@/lib/dashboard/schema';
import { getPanelCatalogEntriesForDashboardType } from '@/lib/dashboard/panel-catalog';
import { toDashboardGridLayoutItems } from '@/lib/dashboard/grid-layout';
import {
  DashboardGrid,
  type DashboardPanelSettingsRegistry,
} from '@ui/compositions/DashboardGrid';
import {
  createTimeInRangePanelSettingsRegistration,
  type TimeInRangePanelLayout,
} from '@ui/compositions/TimeInRangePanel';
import { createTextPanelSettingsRegistration } from '@ui/compositions/TextPanel';
import { useDashboardNotifications } from './useDashboardNotifications';

interface DashboardGridRuntimeProps {
  dashboardUid: string;
  dashboardType?: DashboardType;
  dashboardVersion?: number | null;
  layout: GridLayoutKind;
  children: ReactNode;
  isOwner: boolean;
  initialElements?: Record<string, PanelKind>;
  renderPanel?: (panelId: string, panel: PanelKind) => ReactNode;
  viewedPanelId?: string | null;
  onViewedPanelChange?: (panelId: string | null, navigationMode?: 'push' | 'replace') => void;
  editedPanelId?: string | null;
  onEditedPanelChange?: (panelId: string | null, navigationMode?: 'push' | 'replace') => void;
  settingsRegistry?: DashboardPanelSettingsRegistry;
  initialPanelSettings?: Record<string, unknown>;
  initialTimeSettings?: DashboardTimeSettingsKind;
  currentTimeSettings?: DashboardTimeSettingsKind;
  onDiscardTimeSettings?: (timeSettings: DashboardTimeSettingsKind) => void;
  timeInRangeDefaultLayout?: TimeInRangePanelLayout;
  editControlsPortalId?: string;
  allowDashboardDelete?: boolean;
}

const EMPTY_SETTINGS_REGISTRY: DashboardPanelSettingsRegistry = {};
const DASHBOARD_SETTINGS_SAVE_TIMEOUT_MS = 15_000;

async function fetchDashboardSettingsSave(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, DASHBOARD_SETTINGS_SAVE_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Saving dashboard settings timed out. Try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function DashboardGridRuntime({
  dashboardUid,
  dashboardType,
  dashboardVersion = null,
  layout,
  children,
  isOwner,
  initialElements,
  renderPanel,
  viewedPanelId,
  onViewedPanelChange,
  editedPanelId,
  onEditedPanelChange,
  settingsRegistry: providedSettingsRegistry = EMPTY_SETTINGS_REGISTRY,
  initialPanelSettings,
  initialTimeSettings,
  currentTimeSettings,
  onDiscardTimeSettings,
  timeInRangeDefaultLayout,
  editControlsPortalId,
  allowDashboardDelete = false,
}: DashboardGridRuntimeProps): ReactElement {
  const router = useRouter();
  const [savedVersion, setSavedVersion] = useState<number | null>(dashboardVersion);
  const {
    notifyDashboardDeleteFailed,
    notifyDashboardDeleted,
    notifyDashboardSaveFailed,
    notifyDashboardSaveRequiresAdmin,
    notifyDashboardSaved,
  } = useDashboardNotifications({ dashboardUid });
  const settingsRegistry = useMemo<DashboardPanelSettingsRegistry>(() => {
    const registry: DashboardPanelSettingsRegistry = { ...providedSettingsRegistry };

    if (!timeInRangeDefaultLayout) {
      registry['veno.text'] = registry['veno.text'] ?? createTextPanelSettingsRegistration();
      return registry;
    }

    registry['veno.time-in-range'] = createTimeInRangePanelSettingsRegistration(timeInRangeDefaultLayout);
    registry['veno.text'] = registry['veno.text'] ?? createTextPanelSettingsRegistration();
    return registry;
  }, [providedSettingsRegistry, timeInRangeDefaultLayout]);

  useEffect(() => {
    setSavedVersion(dashboardVersion);
  }, [dashboardVersion]);

  const handleSaveDashboard = useCallback(async (input: {
    panelSettings: Record<string, unknown>;
    layout: Layout;
    elements?: Record<string, PanelKind>;
    timeSettings?: DashboardTimeSettingsKind;
  }) => {
    try {
      const response = await fetchDashboardSettingsSave(`/api/dashboard/settings/dashboards/${encodeURIComponent(dashboardUid)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expectedVersion: savedVersion,
          elements: input.elements,
          panelSettings: input.panelSettings,
          layout: toDashboardGridLayoutItems(input.layout).map((item) => ({
            element: item.spec.element.name,
            x: item.spec.x,
            y: item.spec.y,
            width: item.spec.width,
            height: item.spec.height,
          })),
          timeSettings: input.timeSettings,
        }),
      });
      const json = await response.json() as DashboardSettingsResponse & { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(json.error?.message || 'Failed to save dashboard settings.');
      }

      setSavedVersion(json.dashboardSettings.version);
      notifyDashboardSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save dashboard settings.';
      notifyDashboardSaveFailed(message);
      throw error;
    }
  }, [dashboardUid, notifyDashboardSaveFailed, notifyDashboardSaved, savedVersion]);

  const handleDeleteDashboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/dashboard/dashboards/${encodeURIComponent(dashboardUid)}`, {
        method: 'DELETE',
      });
      const json = await response.json() as { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(json.error?.message || 'Failed to delete dashboard.');
      }

      notifyDashboardDeleted();
      router.push('/dashboards');
    } catch (error) {
      notifyDashboardDeleteFailed(error instanceof Error ? error.message : undefined);
      throw error;
    }
  }, [dashboardUid, notifyDashboardDeleteFailed, notifyDashboardDeleted, router]);

  return (
    <DashboardGrid
      layout={layout}
      dashboardType={dashboardType}
      isOwner={isOwner}
      viewedPanelId={viewedPanelId}
      onViewedPanelChange={onViewedPanelChange}
      editedPanelId={editedPanelId}
      onEditedPanelChange={onEditedPanelChange}
      settingsRegistry={settingsRegistry}
      initialElements={initialElements}
      renderPanel={renderPanel}
      panelCatalogEntries={dashboardType ? getPanelCatalogEntriesForDashboardType(dashboardType) : []}
      initialPanelSettings={initialPanelSettings}
      initialTimeSettings={initialTimeSettings}
      currentTimeSettings={currentTimeSettings}
      onDiscardTimeSettings={onDiscardTimeSettings}
      editControlsPortalId={editControlsPortalId}
      onUnauthorizedSaveDashboard={notifyDashboardSaveRequiresAdmin}
      onSaveDashboard={handleSaveDashboard}
      onDeleteDashboard={allowDashboardDelete ? handleDeleteDashboard : undefined}
    >
      {children}
    </DashboardGrid>
  );
}
