import { describe, expect, test } from 'vitest';
import { parseDashboardDefinition } from '@/lib/dashboard/schema';

describe('dashboard schema', () => {
  test('parses a grid layout item that references a panel element', () => {
    const dashboard = parseDashboardDefinition({
      kind: 'Dashboard',
      spec: {
        uid: 'overview',
        title: 'Overview',
        elements: {
          'panel-current-glucose': {
            kind: 'Panel',
            spec: {
              id: 1,
              title: 'Current Glucose',
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
                group: 'veno.live-glucose',
                version: 'v1',
                spec: {
                  options: {},
                  fieldConfig: {
                    defaults: {},
                    overrides: [],
                  },
                },
              },
            },
          },
        },
        layout: {
          kind: 'GridLayout',
          spec: {
            items: [
              {
                kind: 'GridLayoutItem',
                spec: {
                  x: 0,
                  y: 0,
                  width: 4,
                  height: 6,
                  element: {
                    kind: 'ElementReference',
                    name: 'panel-current-glucose',
                  },
                },
              },
            ],
          },
        },
      },
    });

    expect(dashboard.spec.title).toBe('Overview');
    expect(dashboard.spec.timeSettings).toEqual({
      autoRefresh: '',
      autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h'],
    });
    expect(dashboard.spec.layout.spec.items[0]?.spec.element.name).toBe('panel-current-glucose');
    expect(dashboard.spec.elements['panel-current-glucose']?.spec.vizConfig.group).toBe('veno.live-glucose');
  });

  test('rejects a grid layout item that references a missing element', () => {
    expect(() =>
      parseDashboardDefinition({
        kind: 'Dashboard',
        spec: {
          uid: 'overview',
          title: 'Overview',
          elements: {},
          layout: {
            kind: 'GridLayout',
            spec: {
              items: [
                {
                  kind: 'GridLayoutItem',
                  spec: {
                    x: 0,
                    y: 0,
                    width: 4,
                    height: 6,
                    element: {
                      kind: 'ElementReference',
                      name: 'panel-current-glucose',
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    ).toThrow('Dashboard layout references missing element "panel-current-glucose".');
  });

  test('fills panel data and visualization defaults', () => {
    const dashboard = parseDashboardDefinition({
      kind: 'Dashboard',
      spec: {
        uid: 'overview',
        title: 'Overview',
        elements: {
          'panel-current-glucose': {
            kind: 'Panel',
            spec: {
              id: 1,
              title: 'Current Glucose',
              vizConfig: {
                kind: 'VizConfig',
                group: 'veno.live-glucose',
                version: 'v1',
              },
            },
          },
        },
        layout: {
          kind: 'GridLayout',
          spec: {
            items: [
              {
                kind: 'GridLayoutItem',
                spec: {
                  x: 0,
                  y: 0,
                  width: 4,
                  height: 6,
                  element: {
                    kind: 'ElementReference',
                    name: 'panel-current-glucose',
                  },
                },
              },
            ],
          },
        },
      },
    });

    const panel = dashboard.spec.elements['panel-current-glucose'];
    expect(panel?.spec.data.spec.queries).toEqual([]);
    expect(panel?.spec.vizConfig.spec.options).toEqual({});
    expect(panel?.spec.vizConfig.spec.fieldConfig).toEqual({
      defaults: {},
      overrides: [],
    });
  });
});
