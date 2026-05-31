import type { ReactElement } from 'react';
import type { DashboardDefinition, DashboardTimeSettingsKind, DashboardType, PanelKind } from '@/lib/dashboard/schema';
import { extractDashboardPanelSettings } from '@/lib/dashboard/settings';
import type { DashboardPanelRegistry } from '@/lib/dashboard/panel-registry';
import { DashboardGridPanel } from '@ui/compositions/DashboardGrid';
import type { DashboardPanelSettingsRegistry } from '@ui/compositions/DashboardGrid';
import type { TimeInRangePanelLayout } from '@ui/compositions/TimeInRangePanel';
import { DashboardGridRuntime } from './DashboardGridRuntime';

interface DashboardDefinitionRendererProps<TContext> {
  dashboard: DashboardDefinition;
  dashboardType?: DashboardType;
  panelRegistry: DashboardPanelRegistry<TContext>;
  context: TContext;
  isOwner?: boolean;
  viewedPanelId?: string | null;
  onViewedPanelChange?: (panelId: string | null, navigationMode?: 'push' | 'replace') => void;
  editedPanelId?: string | null;
  onEditedPanelChange?: (panelId: string | null, navigationMode?: 'push' | 'replace') => void;
  dashboardVersion?: number | null;
  settingsRegistry?: DashboardPanelSettingsRegistry;
  timeSettings?: DashboardTimeSettingsKind;
  onDiscardTimeSettings?: (timeSettings: DashboardTimeSettingsKind) => void;
  timeInRangeDefaultLayout?: TimeInRangePanelLayout;
  editControlsPortalId?: string;
  allowDashboardDelete?: boolean;
}

export const DashboardDefinitionRenderer = <TContext,>({
  dashboard,
  dashboardType,
  panelRegistry,
  context,
  isOwner = false,
  viewedPanelId,
  onViewedPanelChange,
  editedPanelId,
  onEditedPanelChange,
  dashboardVersion = null,
  settingsRegistry,
  timeSettings,
  onDiscardTimeSettings,
  timeInRangeDefaultLayout,
  editControlsPortalId,
  allowDashboardDelete,
}: DashboardDefinitionRendererProps<TContext>): ReactElement => {
  return (
    <DashboardGridRuntime
      dashboardUid={dashboard.spec.uid}
      dashboardType={dashboardType}
      dashboardVersion={dashboardVersion}
      layout={dashboard.spec.layout}
      isOwner={isOwner}
      initialElements={dashboard.spec.elements}
      renderPanel={(panelId: string, panel: PanelKind) => {
        const registration = panelRegistry.resolve(panel.spec.vizConfig.group);
        const content = registration.render({ panelId, panel, context });

        if (!content) {
          return null;
        }

        return (
          <DashboardGridPanel
            key={panelId}
            panelId={panelId}
            title={panel.spec.title}
          >
            {content}
          </DashboardGridPanel>
        );
      }}
      viewedPanelId={viewedPanelId}
      onViewedPanelChange={onViewedPanelChange}
      editedPanelId={editedPanelId}
      onEditedPanelChange={onEditedPanelChange}
      settingsRegistry={settingsRegistry}
      initialPanelSettings={extractDashboardPanelSettings(dashboard)}
      initialTimeSettings={dashboard.spec.timeSettings}
      currentTimeSettings={timeSettings ?? dashboard.spec.timeSettings}
      onDiscardTimeSettings={onDiscardTimeSettings}
      timeInRangeDefaultLayout={timeInRangeDefaultLayout}
      editControlsPortalId={editControlsPortalId}
      allowDashboardDelete={allowDashboardDelete}
    >
      {dashboard.spec.layout.spec.items.map((item) => {
        const panelId = item.spec.element.name;
        const panel = dashboard.spec.elements[panelId];
        const registration = panelRegistry.resolve(panel.spec.vizConfig.group);
        const content = registration.render({ panelId, panel, context });

        if (!content) {
          return null;
        }

        return (
          <DashboardGridPanel
            key={item.spec.element.name}
            panelId={panelId}
            title={panel.spec.title}
          >
            {content}
          </DashboardGridPanel>
        );
      })}
    </DashboardGridRuntime>
  );
};
