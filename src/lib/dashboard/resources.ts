import { fetchDashboardResource, fetchDashboardSettings, PulseApiClientError } from '@/lib/pulse-api/client';
import { hasAdminApiToken } from '@/lib/pulse-api/env';
import type { TimeRange } from '@/lib/glucose/time-ranges';
import type { DashboardDescriptionDocument, DashboardIconName } from './metadata';
import { validateDashboardPanelCompatibility } from './panel-catalog';
import { parseDashboardDefinition, type DashboardDefinition, type DashboardType } from './schema';

export interface LoadedDashboardResource {
  dashboard: DashboardDefinition;
  description: DashboardDescriptionDocument | null;
  icon: DashboardIconName | null;
  defaultTimeRange: TimeRange | null;
  type: DashboardType;
  version: number | null;
  source: 'api';
}

export class DashboardResourceRedirectError extends Error {
  dashboardUid: string;

  constructor(dashboardUid: string) {
    super('Dashboard moved.');
    this.name = 'DashboardResourceRedirectError';
    this.dashboardUid = dashboardUid;
  }
}

async function loadPersistedDashboardSettings(dashboardUid: string): Promise<DashboardDefinition | null> {
  if (!hasAdminApiToken()) {
    return null;
  }

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

function applyDashboardResourceMetadata(
  dashboard: DashboardDefinition,
  metadata: {
    uid: string;
    title: string;
  },
): DashboardDefinition {
  return {
    ...dashboard,
    spec: {
      ...dashboard.spec,
      uid: metadata.uid,
      title: metadata.title,
    },
  };
}

export async function loadDashboardResource(dashboardUid: string): Promise<LoadedDashboardResource> {
  const response = await fetchDashboardResource(dashboardUid);
  if ('redirect' in response) {
    throw new DashboardResourceRedirectError(response.redirect.dashboardUid);
  }

  const persistedDashboard = await loadPersistedDashboardSettings(dashboardUid)
    ?? parseDashboardDefinition(response.dashboard.dashboard);
  const dashboard = applyDashboardResourceMetadata(persistedDashboard, response.dashboard);

  validateDashboardPanelCompatibility(dashboard, response.dashboard.type);

  return {
    dashboard,
    description: response.dashboard.description ?? null,
    icon: response.dashboard.icon ?? null,
    defaultTimeRange: response.dashboard.defaultTimeRange ?? null,
    type: response.dashboard.type,
    version: response.dashboard.version,
    source: 'api',
  };
}
