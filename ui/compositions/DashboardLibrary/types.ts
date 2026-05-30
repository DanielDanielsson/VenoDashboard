import type { DashboardLibraryItem } from '@/lib/dashboard/library';

export interface DashboardMetadataSaveResult {
  previousUid?: string;
  dashboard?: {
    uid?: string;
    title?: string;
    description?: DashboardLibraryItem['description'];
    icon?: DashboardLibraryItem['icon'];
    defaultTimeRange?: DashboardLibraryItem['defaultTimeRange'];
    version?: number;
  };
  preferences?: {
    homeDashboardUid?: string;
    pinnedDashboardUids?: string[];
    dashboardOrderUids?: string[];
  };
}
