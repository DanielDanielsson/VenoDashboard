import { fetchDashboardPreferences } from '@/lib/pulse-api/client';

export interface LoadedDashboardPreferences {
  homeDashboardUid: string;
  pinnedDashboardUids: string[];
  source: 'api' | 'fallback';
}

const FALLBACK_DASHBOARD_PREFERENCES: LoadedDashboardPreferences = {
  homeDashboardUid: 'overview',
  pinnedDashboardUids: [],
  source: 'fallback',
};

export async function loadDashboardPreferences(): Promise<LoadedDashboardPreferences> {
  try {
    const response = await fetchDashboardPreferences();

    return {
      homeDashboardUid: response.preferences.homeDashboardUid,
      pinnedDashboardUids: response.preferences.pinnedDashboardUids,
      source: 'api',
    };
  } catch {
    return FALLBACK_DASHBOARD_PREFERENCES;
  }
}
