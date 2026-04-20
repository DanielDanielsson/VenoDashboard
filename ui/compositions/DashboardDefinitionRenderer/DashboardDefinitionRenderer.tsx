import type { ReactElement } from 'react';
import type { DashboardDefinition, DashboardTimeSettingsKind } from '@/lib/dashboard/schema';
import { extractDashboardPanelSettings } from '@/lib/dashboard/settings';
import type { DashboardPanelRegistry } from '@/lib/dashboard/panel-registry';
import { DashboardGridPanel } from '@ui/compositions/DashboardGrid';
import type { DashboardPanelSettingsRegistry } from '@ui/compositions/DashboardGrid';
import type { TimeInRangePanelLayout } from '@ui/compositions/TimeInRangePanel';
import { DashboardGridRuntime } from './DashboardGridRuntime';

interface DashboardDefinitionRendererProps<TContext> {
  dashboard: DashboardDefinition;
  panelRegistry: DashboardPanelRegistry<TContext>;
  context: TContext;
  isOwner?: boolean;
  dashboardVersion?: number | null;
  settingsRegistry?: DashboardPanelSettingsRegistry;
  timeSettings?: DashboardTimeSettingsKind;
  onDiscardTimeSettings?: (timeSettings: DashboardTimeSettingsKind) => void;
  timeInRangeDefaultLayout?: TimeInRangePanelLayout;
  editControlsPortalId?: string;
}

export function DashboardDefinitionRenderer<TContext>({
  dashboard,
  panelRegistry,
  context,
  isOwner = false,
  dashboardVersion = null,
  settingsRegistry,
  timeSettings,
  onDiscardTimeSettings,
  timeInRangeDefaultLayout,
  editControlsPortalId,
}: DashboardDefinitionRendererProps<TContext>): ReactElement {
  return (
    <DashboardGridRuntime
      dashboardUid={dashboard.spec.uid}
      dashboardVersion={dashboardVersion}
      layout={dashboard.spec.layout}
      isOwner={isOwner}
      settingsRegistry={settingsRegistry}
      initialPanelSettings={extractDashboardPanelSettings(dashboard)}
      initialTimeSettings={dashboard.spec.timeSettings}
      currentTimeSettings={timeSettings ?? dashboard.spec.timeSettings}
      onDiscardTimeSettings={onDiscardTimeSettings}
      timeInRangeDefaultLayout={timeInRangeDefaultLayout}
      editControlsPortalId={editControlsPortalId}
    >
      {dashboard.spec.layout.spec.items.map((item) => {
        const panel = dashboard.spec.elements[item.spec.element.name];
        const registration = panelRegistry.resolve(panel.spec.vizConfig.group);
        const content = registration.render({ panel, context });

        if (!content) {
          return null;
        }

        return (
          <DashboardGridPanel
            key={item.spec.element.name}
            panelId={item.spec.element.name}
            title={panel.spec.title}
          >
            {content}
          </DashboardGridPanel>
        );
      })}
    </DashboardGridRuntime>
  );
}
