import type { DashboardDefinition } from '@/lib/dashboard/schema';

export function getDashboardViewPanelAliases(dashboard: DashboardDefinition): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dashboard.spec.elements).flatMap(([panelId, panel]) => [
      [String(panel.spec.id), panelId],
    ]),
  );
}
