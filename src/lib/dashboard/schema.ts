export interface DashboardDefinition {
  kind: 'Dashboard';
  spec: DashboardSpec;
}

export interface DashboardSpec {
  uid: string;
  title: string;
  timeSettings: DashboardTimeSettingsKind;
  elements: Record<string, DashboardElement>;
  layout: GridLayoutKind;
}

export interface DashboardTimeSettingsKind {
  autoRefresh: string;
  autoRefreshIntervals: string[];
}

export type DashboardElement = PanelKind;

export interface PanelKind {
  kind: 'Panel';
  spec: PanelSpec;
}

export interface PanelSpec {
  id: number;
  title: string;
  data: QueryGroupKind;
  vizConfig: VizConfigKind;
}

export interface QueryGroupKind {
  kind: 'QueryGroup';
  spec: {
    queries: unknown[];
    transformations: unknown[];
    queryOptions: Record<string, unknown>;
  };
}

export interface VizConfigKind {
  kind: 'VizConfig';
  group: string;
  version: string;
  spec: {
    options: Record<string, unknown>;
    fieldConfig: {
      defaults: Record<string, unknown>;
      overrides: unknown[];
    };
  };
}

export interface GridLayoutKind {
  kind: 'GridLayout';
  spec: {
    items: GridLayoutItemKind[];
  };
}

export interface GridLayoutItemKind {
  kind: 'GridLayoutItem';
  spec: {
    x: number;
    y: number;
    width: number;
    height: number;
    element: ElementReferenceKind;
  };
}

export interface ElementReferenceKind {
  kind: 'ElementReference';
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function defaultQueryGroup(): QueryGroupKind {
  return {
    kind: 'QueryGroup',
    spec: {
      queries: [],
      transformations: [],
      queryOptions: {},
    },
  };
}

function defaultTimeSettings(): DashboardTimeSettingsKind {
  return {
    autoRefresh: '',
    autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h'],
  };
}

function normalizePanelElement(element: DashboardElement): DashboardElement {
  const rawVizConfig = element.spec.vizConfig as VizConfigKind & {
    spec?: Partial<VizConfigKind['spec']>;
  };
  const rawFieldConfig = rawVizConfig.spec?.fieldConfig;

  return {
    ...element,
    spec: {
      ...element.spec,
      data: element.spec.data ?? defaultQueryGroup(),
      vizConfig: {
        ...rawVizConfig,
        spec: {
          options: rawVizConfig.spec?.options ?? {},
          fieldConfig: {
            defaults: rawFieldConfig?.defaults ?? {},
            overrides: rawFieldConfig?.overrides ?? [],
          },
        },
      },
    },
  };
}

export function parseDashboardDefinition(input: unknown): DashboardDefinition {
  if (!isRecord(input) || input.kind !== 'Dashboard' || !isRecord(input.spec)) {
    throw new Error('Dashboard definition must be a Dashboard object.');
  }

  const rawDashboard = input as unknown as DashboardDefinition;
  const dashboard: DashboardDefinition = {
    ...rawDashboard,
    spec: {
      ...rawDashboard.spec,
      timeSettings: rawDashboard.spec.timeSettings ?? defaultTimeSettings(),
      elements: Object.fromEntries(
        Object.entries(rawDashboard.spec.elements).map(([name, element]) => [
          name,
          normalizePanelElement(element),
        ]),
      ),
    },
  };
  const elements = dashboard.spec.elements;
  const items = dashboard.spec.layout.spec.items;

  for (const item of items) {
    const elementName = item.spec.element.name;
    if (!elements[elementName]) {
      throw new Error(`Dashboard layout references missing element "${elementName}".`);
    }
  }

  return dashboard;
}
