import type { DashboardDefinition, DashboardType, PanelKind } from './schema';

export interface DashboardPanelCatalogEntry {
  id: string;
  elementName: string;
  title: string;
  group: string;
  category?: {
    kind: 'device';
    label: string;
  };
  compatibleDashboardTypes: DashboardType[];
  allowMultiple?: boolean;
  defaultLayout: {
    width: number;
    height: number;
    aspectRatio?: number;
  };
  defaultDefinition: PanelKind;
}

function panel(id: number, title: string, group: string, options: Record<string, unknown> = {}): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      id,
      title,
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: [],
          transformations: [],
          queryOptions: {},
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group,
        version: 'v1',
        spec: {
          options,
          fieldConfig: {
            defaults: {},
            overrides: [],
          },
        },
      },
    },
  };
}

export const DASHBOARD_PANEL_CATALOG: DashboardPanelCatalogEntry[] = [
  {
    id: 'current-glucose',
    elementName: 'panel-current-glucose',
    title: 'Current Glucose',
    group: 'veno.live-glucose',
    compatibleDashboardTypes: ['live'],
    defaultLayout: { width: 4, height: 8, aspectRatio: 1.35 },
    defaultDefinition: panel(1, 'Current Glucose', 'veno.live-glucose'),
  },
  {
    id: 'connections',
    elementName: 'panel-connections',
    title: 'Connections',
    group: 'veno.connections-map',
    compatibleDashboardTypes: ['live'],
    defaultLayout: { width: 12, height: 17, aspectRatio: 2.2 },
    defaultDefinition: panel(4, 'Connections', 'veno.connections-map'),
  },
  {
    id: 'active-timers',
    elementName: 'panel-timers',
    title: 'Timers',
    group: 'veno.shared-timers',
    compatibleDashboardTypes: ['live'],
    defaultLayout: { width: 4, height: 8, aspectRatio: 1.35 },
    defaultDefinition: panel(2, 'Timers', 'veno.shared-timers'),
  },
  {
    id: 'average-glucose',
    elementName: 'panel-average-glucose',
    title: 'Average Glucose',
    group: 'veno.average-glucose',
    compatibleDashboardTypes: ['timeRange'],
    defaultLayout: { width: 4, height: 6, aspectRatio: 1.45 },
    defaultDefinition: panel(101, 'Average Glucose', 'veno.average-glucose'),
  },
  {
    id: 'time-in-range',
    elementName: 'panel-time-in-range',
    title: 'Time in Range',
    group: 'veno.time-in-range',
    compatibleDashboardTypes: ['timeRange'],
    defaultLayout: { width: 4, height: 6, aspectRatio: 1.45 },
    defaultDefinition: panel(103, 'Time in Range', 'veno.time-in-range', { layout: 'statistics' }),
  },
  {
    id: 'workout-types',
    elementName: 'panel-workout-types',
    title: 'Workout Types',
    group: 'veno.workout-types',
    compatibleDashboardTypes: ['timeRange'],
    defaultLayout: { width: 4, height: 6, aspectRatio: 1.45 },
    defaultDefinition: panel(106, 'Workout Types', 'veno.workout-types'),
  },
  {
    id: 'dexcom-glucose-readings',
    elementName: 'panel-dexcom-glucose-readings',
    title: 'Glucose Readings',
    group: 'veno.dexcom-glucose-readings',
    category: {
      kind: 'device',
      label: 'Dexcom G7',
    },
    compatibleDashboardTypes: ['timeRange'],
    defaultLayout: { width: 12, height: 12, aspectRatio: 2.4 },
    defaultDefinition: panel(107, 'Glucose Readings', 'veno.dexcom-glucose-readings'),
  },
  {
    id: 'glucose-timeline',
    elementName: 'panel-glucose-timeline',
    title: 'Glucose Timeline',
    group: 'veno.glucose-timeline',
    compatibleDashboardTypes: ['timeRange'],
    defaultLayout: { width: 12, height: 24, aspectRatio: 1.6 },
    defaultDefinition: panel(104, 'Glucose Timeline', 'veno.glucose-timeline'),
  },
  {
    id: 'agp',
    elementName: 'panel-agp',
    title: 'Ambulatory Glucose Profile',
    group: 'veno.glucose-agp',
    compatibleDashboardTypes: ['timeRange'],
    defaultLayout: { width: 12, height: 14, aspectRatio: 1.8 },
    defaultDefinition: panel(105, 'Ambulatory Glucose Profile', 'veno.glucose-agp'),
  },
  {
    id: 'text',
    elementName: 'panel-text',
    title: 'Text',
    group: 'veno.text',
    compatibleDashboardTypes: ['live', 'timeRange'],
    defaultLayout: { width: 4, height: 6, aspectRatio: 1.45 },
    defaultDefinition: panel(201, 'Text', 'veno.text', {
      content: {
        version: 1,
        blocks: [
          {
            id: 'intro',
            type: 'paragraph',
            spans: [
              {
                text: 'Add descriptive text for this dashboard.',
              },
            ],
          },
        ],
      },
    }),
  },
];

export function allowsMultiplePanelInstances(entry: DashboardPanelCatalogEntry): boolean {
  return entry.allowMultiple !== false;
}

export function getPanelCatalogEntry(group: string): DashboardPanelCatalogEntry | null {
  return DASHBOARD_PANEL_CATALOG.find((entry) => entry.group === group) ?? null;
}

export function getPanelCatalogEntriesForDashboardType(
  dashboardType: DashboardType,
): DashboardPanelCatalogEntry[] {
  return DASHBOARD_PANEL_CATALOG.filter((entry) => entry.compatibleDashboardTypes.includes(dashboardType));
}

export function validateDashboardPanelCompatibility(
  dashboard: DashboardDefinition,
  dashboardType: DashboardType,
): void {
  for (const [panelId, panel] of Object.entries(dashboard.spec.elements)) {
    const entry = getPanelCatalogEntry(panel.spec.vizConfig.group);
    if (!entry) {
      throw new Error(`Panel "${panelId}" uses unknown panel group "${panel.spec.vizConfig.group}".`);
    }

    if (!entry.compatibleDashboardTypes.includes(dashboardType)) {
      throw new Error(`Panel "${panelId}" is not compatible with ${dashboardType} dashboards.`);
    }
  }
}
