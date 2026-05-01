'use client';

import { DashboardDefinitionRenderer, overviewPanelRegistry, type OverviewDashboardContext } from '@ui/compositions/DashboardDefinitionRenderer';
import { DashboardUrlStateBridge } from '@ui/compositions/DashboardUrlStateBridge/DashboardUrlStateBridge';
import { DashboardViewPanelUrlStateBridge } from '@ui/compositions/DashboardViewPanelUrlStateBridge/DashboardViewPanelUrlStateBridge';
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
  return (
    <>
      <DashboardUrlStateBridge dashboardTitle={dashboard.spec.title} rejectTimeRange />
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
            timeInRangeDefaultLayout="overview"
            context={context}
            allowDashboardDelete={allowDashboardDelete}
          />
        )}
      </DashboardViewPanelUrlStateBridge>
    </>
  );
}
