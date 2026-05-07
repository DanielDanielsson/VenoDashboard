'use client';

import { useMemo } from 'react';
import {
  DashboardDefinitionRenderer,
  overviewPanelRegistry,
  type OverviewDashboardContext,
} from '@ui/compositions/DashboardDefinitionRenderer';
import type { DashboardPanelSettingsRegistry } from '@ui/compositions/DashboardGrid';
import { DashboardUrlStateBridge } from '@ui/compositions/DashboardUrlStateBridge/DashboardUrlStateBridge';
import { DashboardViewPanelUrlStateBridge } from '@ui/compositions/DashboardViewPanelUrlStateBridge/DashboardViewPanelUrlStateBridge';
import { createCurrentGlucosePanelSettingsRegistration } from '@ui/compositions/LiveGlucosePanel';
import type { DashboardDefinition } from '@/lib/dashboard/schema';
import { getDashboardViewPanelAliases } from '@/lib/dashboard/view-panel';

interface OverviewDashboardViewProps {
  context: OverviewDashboardContext;
  dashboard: DashboardDefinition;
  dashboardVersion: number | null;
  allowDashboardDelete?: boolean;
}

export function OverviewDashboardView({
  context,
  dashboard,
  dashboardVersion,
  allowDashboardDelete = false,
}: OverviewDashboardViewProps) {
  const settingsRegistry = useMemo<DashboardPanelSettingsRegistry>(
    () => ({
      'panel-current-glucose': createCurrentGlucosePanelSettingsRegistration(),
    }),
    [],
  );

  return (
    <>
      <DashboardUrlStateBridge
        dashboardTitle={dashboard.spec.title}
        rejectTimeRange
      />
      <DashboardViewPanelUrlStateBridge
        dashboardTitle={dashboard.spec.title}
        dashboardUid={dashboard.spec.uid}
        allowedPanelIds={Object.keys(dashboard.spec.elements)}
        panelIdAliases={getDashboardViewPanelAliases(dashboard)}
      >
        {({ viewedPanelId, onViewedPanelChange }) => (
          <DashboardDefinitionRenderer
            dashboard={dashboard}
            dashboardType="live"
            dashboardVersion={dashboardVersion}
            panelRegistry={overviewPanelRegistry}
            isOwner={context.isOwner}
            viewedPanelId={viewedPanelId}
            onViewedPanelChange={onViewedPanelChange}
            settingsRegistry={settingsRegistry}
            timeInRangeDefaultLayout="overview"
            context={context}
            allowDashboardDelete={allowDashboardDelete}
          />
        )}
      </DashboardViewPanelUrlStateBridge>
    </>
  );
}
