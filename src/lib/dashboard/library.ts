import { fetchDashboardList } from '@/lib/pulse-api/client';
import type { DashboardType } from './schema';
import { loadDashboardPreferences } from './preferences';

export interface DashboardLibraryItem {
  uid: string;
  title: string;
  type: DashboardType;
  version: number | null;
  updatedAt: string | null;
  isHome: boolean;
  isPinned: boolean;
}

export interface DashboardLibrary {
  dashboards: DashboardLibraryItem[];
}

function updatedAtMillis(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadDashboardLibrary(): Promise<DashboardLibrary> {
  const [dashboardResponse, preferences] = await Promise.all([
    fetchDashboardList(),
    loadDashboardPreferences(),
  ]);
  const pinnedIndex = new Map(
    preferences.pinnedDashboardUids.map((dashboardUid, index) => [dashboardUid, index]),
  );
  const dashboards = dashboardResponse.dashboards
    .map((dashboard) => ({
      uid: dashboard.uid,
      title: dashboard.title,
      type: dashboard.type,
      version: dashboard.version,
      updatedAt: dashboard.updatedAt ?? null,
      isHome: dashboard.uid === preferences.homeDashboardUid,
      isPinned: pinnedIndex.has(dashboard.uid),
    }))
    .sort((left, right) => {
      const leftPinnedIndex = pinnedIndex.get(left.uid);
      const rightPinnedIndex = pinnedIndex.get(right.uid);

      if (leftPinnedIndex !== undefined || rightPinnedIndex !== undefined) {
        if (leftPinnedIndex === undefined) {
          return 1;
        }

        if (rightPinnedIndex === undefined) {
          return -1;
        }

        return leftPinnedIndex - rightPinnedIndex;
      }

      return updatedAtMillis(right.updatedAt) - updatedAtMillis(left.updatedAt);
    });

  return { dashboards };
}
