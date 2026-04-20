import type { DashboardTimeSettingsKind, GridLayoutItemKind } from './schema';
import { PulseApiClientError, fetchDashboardSettings } from '@/lib/pulse-api/client';
import { getDashboardDefinition, type BuiltInDashboardUid } from './registry';
import { parseDashboardDefinition, type DashboardDefinition } from './schema';

export const DASHBOARD_SETTINGS_SCHEMA_VERSION = 'veno.dashboard-settings.v2';

export type DashboardPanelSettingsMap = Record<string, Record<string, unknown>>;
export type DashboardLayoutSaveInput = Array<{
  element: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type PersistedDashboardDefinition = DashboardDefinition & {
  schemaVersion?: string;
};

export interface DashboardSettingsRecord {
  dashboardUid: string;
  schemaVersion: string;
  version: number;
  dashboard: PersistedDashboardDefinition;
  updatedAt: string;
  updatedBy: {
    actor?: string;
    apiKeyId: string | null;
    apiKeyName: string | null;
  };
}

export interface DashboardSettingsResponse {
  dashboardSettings: DashboardSettingsRecord;
}

export interface LoadedDashboardDefinition {
  dashboard: DashboardDefinition;
  version: number | null;
}

export async function loadDashboardDefinition(dashboardUid: BuiltInDashboardUid): Promise<LoadedDashboardDefinition> {
  try {
    const response = await fetchDashboardSettings(dashboardUid);

    return {
      dashboard: parseDashboardDefinition(response.dashboardSettings.dashboard),
      version: response.dashboardSettings.version,
    };
  } catch (error) {
    if (!(error instanceof PulseApiClientError) || error.status === 404) {
      return {
        dashboard: getDashboardDefinition(dashboardUid),
        version: null,
      };
    }

    throw error;
  }
}

export function extractDashboardPanelSettings(dashboard: DashboardDefinition): DashboardPanelSettingsMap {
  return Object.fromEntries(
    Object.entries(dashboard.spec.elements).map(([panelId, element]) => [
      panelId,
      element.spec.vizConfig.spec.options,
    ]),
  );
}

function toPersistedLayoutItems(layout: DashboardLayoutSaveInput): GridLayoutItemKind[] {
  return layout.map((item) => ({
    kind: 'GridLayoutItem',
    spec: {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      element: {
        kind: 'ElementReference',
        name: item.element,
      },
    },
  }));
}

export function buildDashboardSettingsDocument(
  dashboardUid: BuiltInDashboardUid,
  input: {
    panelSettings?: DashboardPanelSettingsMap;
    layout?: DashboardLayoutSaveInput;
    timeSettings?: DashboardTimeSettingsKind;
  } = {},
): PersistedDashboardDefinition {
  const dashboard = structuredClone(getDashboardDefinition(dashboardUid)) as PersistedDashboardDefinition;
  dashboard.schemaVersion = DASHBOARD_SETTINGS_SCHEMA_VERSION;

  for (const [panelId, settings] of Object.entries(input.panelSettings ?? {})) {
    const panel = dashboard.spec.elements[panelId];
    if (!panel) {
      continue;
    }

    panel.spec.vizConfig.spec.options = {
      ...panel.spec.vizConfig.spec.options,
      ...settings,
    };
  }

  if (input.layout?.length) {
    dashboard.spec.layout.spec.items = toPersistedLayoutItems(input.layout);
  }

  if (input.timeSettings) {
    dashboard.spec.timeSettings = input.timeSettings;
  }

  return dashboard;
}
