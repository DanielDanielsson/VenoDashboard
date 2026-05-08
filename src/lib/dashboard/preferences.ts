import { fetchDashboardPreferences } from '@/lib/pulse-api/client';

export interface LoadedDashboardPreferences {
  homeDashboardUid: string;
  pinnedDashboardUids: string[];
  source: 'api';
}

export async function loadDashboardPreferences(): Promise<LoadedDashboardPreferences> {
  const response = await fetchDashboardPreferences();

  return {
    homeDashboardUid: response.preferences.homeDashboardUid,
    pinnedDashboardUids: response.preferences.pinnedDashboardUids,
    source: 'api',
  };
}
