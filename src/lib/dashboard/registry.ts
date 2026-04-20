import overviewDashboard from './definitions/overview.json';
import statisticsDashboard from './definitions/statistics.json';
import { parseDashboardDefinition, type DashboardDefinition } from './schema';

const DASHBOARD_DEFINITIONS = {
  overview: overviewDashboard,
  statistics: statisticsDashboard,
} as const;

export type BuiltInDashboardUid = keyof typeof DASHBOARD_DEFINITIONS;

export function getDashboardDefinition(uid: BuiltInDashboardUid): DashboardDefinition {
  return parseDashboardDefinition(DASHBOARD_DEFINITIONS[uid]);
}
