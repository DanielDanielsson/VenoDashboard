import { fetchDashboardResource, fetchDashboardSettings, PulseApiClientError } from '@/lib/pulse-api/client';
import { validateDashboardPanelCompatibility } from './panel-catalog';
import { parseDashboardDefinition, type DashboardDefinition, type DashboardType } from './schema';

export interface LoadedDashboardResource {
  dashboard: DashboardDefinition;
  type: DashboardType;
  version: number | null;
  source: 'api';
}

async function loadPersistedDashboardSettings(dashboardUid: string): Promise<DashboardDefinition | null> {
  try {
    const response = await fetchDashboardSettings(dashboardUid);
    return parseDashboardDefinition(response.dashboardSettings.dashboard);
  } catch (error) {
    if (error instanceof PulseApiClientError && error.status === 404) {
      return null;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 404
    ) {
      return null;
    }

    throw error;
  }
}

export async function loadDashboardResource(dashboardUid: string): Promise<LoadedDashboardResource> {
  const response = await fetchDashboardResource(dashboardUid);
  const dashboard = await loadPersistedDashboardSettings(dashboardUid)
    ?? parseDashboardDefinition(response.dashboard.dashboard);

  validateDashboardPanelCompatibility(dashboard, response.dashboard.type);

  return {
    dashboard,
    type: response.dashboard.type,
    version: response.dashboard.version,
    source: 'api',
  };
}
