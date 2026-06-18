import { fetchDashboardPreferences } from '@/lib/veno-api/client';

export interface LoadedDashboardPreferences {
  homeDashboardUid: string | null;
  pinnedDashboardUids: string[];
  dashboardOrderUids: string[];
  source: 'api';
}

export async function loadDashboardPreferences(): Promise<LoadedDashboardPreferences> {
  const response = await fetchDashboardPreferences();

  return {
    homeDashboardUid: response.preferences.homeDashboardUid,
    pinnedDashboardUids: response.preferences.pinnedDashboardUids,
    dashboardOrderUids: response.preferences.dashboardOrderUids ?? [],
    source: 'api',
  };
}
