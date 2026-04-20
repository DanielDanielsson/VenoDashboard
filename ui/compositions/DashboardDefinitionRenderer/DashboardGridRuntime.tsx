'use client';

import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import type { Layout } from 'react-grid-layout';
import type { DashboardSettingsResponse } from '@/lib/dashboard/settings';
import type { DashboardTimeSettingsKind, GridLayoutKind } from '@/lib/dashboard/schema';
import { toDashboardGridLayoutItems } from '@/lib/dashboard/grid-layout';
import { DashboardGrid, type DashboardPanelSettingsRegistry } from '@ui/compositions/DashboardGrid';
import {
  createTimeInRangePanelSettingsRegistration,
  type TimeInRangePanelLayout,
} from '@ui/compositions/TimeInRangePanel';

interface DashboardGridRuntimeProps {
  dashboardUid: string;
  dashboardVersion?: number | null;
  layout: GridLayoutKind;
  children: ReactNode;
  isOwner: boolean;
  settingsRegistry?: DashboardPanelSettingsRegistry;
  initialPanelSettings?: Record<string, unknown>;
  initialTimeSettings?: DashboardTimeSettingsKind;
  currentTimeSettings?: DashboardTimeSettingsKind;
  onDiscardTimeSettings?: (timeSettings: DashboardTimeSettingsKind) => void;
  timeInRangeDefaultLayout?: TimeInRangePanelLayout;
  editControlsPortalId?: string;
}

const EMPTY_SETTINGS_REGISTRY: DashboardPanelSettingsRegistry = {};

export function DashboardGridRuntime({
  dashboardUid,
  dashboardVersion = null,
  layout,
  children,
  isOwner,
  settingsRegistry: providedSettingsRegistry = EMPTY_SETTINGS_REGISTRY,
  initialPanelSettings,
  initialTimeSettings,
  currentTimeSettings,
  onDiscardTimeSettings,
  timeInRangeDefaultLayout,
  editControlsPortalId,
}: DashboardGridRuntimeProps): ReactElement {
  const [savedVersion, setSavedVersion] = useState<number | null>(dashboardVersion);
  const settingsRegistry = useMemo<DashboardPanelSettingsRegistry>(() => {
    const registry: DashboardPanelSettingsRegistry = { ...providedSettingsRegistry };

    if (!timeInRangeDefaultLayout) {
      return registry;
    }

    registry['panel-time-in-range'] = createTimeInRangePanelSettingsRegistration(timeInRangeDefaultLayout);
    return registry;
  }, [providedSettingsRegistry, timeInRangeDefaultLayout]);

  useEffect(() => {
    setSavedVersion(dashboardVersion);
  }, [dashboardVersion]);

  const handleSaveDashboard = useCallback(async (input: {
    panelSettings: Record<string, unknown>;
    layout: Layout;
    timeSettings?: DashboardTimeSettingsKind;
  }) => {
    const response = await fetch(`/api/dashboard/settings/dashboards/${encodeURIComponent(dashboardUid)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expectedVersion: savedVersion,
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
  }, [dashboardUid, savedVersion]);

  return (
    <DashboardGrid
      layout={layout}
      isOwner={isOwner}
      settingsRegistry={settingsRegistry}
      initialPanelSettings={initialPanelSettings}
      initialTimeSettings={initialTimeSettings}
      currentTimeSettings={currentTimeSettings}
      onDiscardTimeSettings={onDiscardTimeSettings}
      editControlsPortalId={editControlsPortalId}
      onSaveDashboard={handleSaveDashboard}
    >
      {children}
    </DashboardGrid>
  );
}
