import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchDashboardResource: vi.fn(),
  fetchDashboardSettings: vi.fn(),
}));

vi.mock('@/lib/veno-api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/veno-api/client')>();
  return {
    ...actual,
    fetchDashboardResource: mocks.fetchDashboardResource,
    fetchDashboardSettings: mocks.fetchDashboardSettings,
  };
});

describe('dashboard resource loading', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.fetchDashboardResource.mockReset();
    mocks.fetchDashboardSettings.mockReset();
    mocks.fetchDashboardSettings.mockRejectedValue(Object.assign(new Error('Dashboard settings were not found.'), {
      status: 404,
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('uses the public dashboard resource when VenoAPI returns one', async () => {
    mocks.fetchDashboardResource.mockResolvedValue({
      dashboard: {
        uid: 'overview',
        title: 'API Overview',
        description: null,
        type: 'live',
        version: 4,
        dashboard: {
          kind: 'Dashboard',
          schemaVersion: 'veno.dashboard.v1',
          spec: {
            uid: 'overview',
            title: 'API Overview',
            timeSettings: {
              autoRefresh: '',
              autoRefreshIntervals: ['5s'],
            },
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
                    spec: {
                      options: {},
                      fieldConfig: { defaults: {}, overrides: [] },
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
        },
      },
    });

    const { loadDashboardResource } = await import('@/lib/dashboard/resources');
    const result = await loadDashboardResource('overview');

    expect(mocks.fetchDashboardResource).toHaveBeenCalledWith('overview');
    expect(result.dashboard.spec.title).toBe('API Overview');
    expect(result.description).toBeNull();
    expect(result.type).toBe('live');
    expect(result.version).toBe(4);
    expect(result.source).toBe('api');
  });

  test('uses the public dashboard resource without loading admin settings when no admin token is configured', async () => {
    vi.stubEnv('ADMIN_BEARER_TOKEN', '');
    mocks.fetchDashboardResource.mockResolvedValue({
      dashboard: {
        uid: 'overview',
        title: 'API Overview',
        description: null,
        type: 'live',
        version: 4,
        dashboard: {
          kind: 'Dashboard',
          schemaVersion: 'veno.dashboard.v1',
          spec: {
            uid: 'overview',
            title: 'API Overview',
            timeSettings: {
              autoRefresh: '',
              autoRefreshIntervals: ['5s'],
            },
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
                    spec: {
                      options: {},
                      fieldConfig: { defaults: {}, overrides: [] },
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
        },
      },
    });

    const { loadDashboardResource } = await import('@/lib/dashboard/resources');
    const result = await loadDashboardResource('overview');

    expect(mocks.fetchDashboardSettings).not.toHaveBeenCalled();
    expect(result.dashboard.spec.title).toBe('API Overview');
  });

  test('prefers persisted dashboard settings over the public dashboard resource document', async () => {
    vi.stubEnv('ADMIN_BEARER_TOKEN', 'test-admin-token');
    mocks.fetchDashboardResource.mockResolvedValue({
      dashboard: {
        uid: 'training-review',
        title: 'Training review renamed',
        description: {
          version: 1,
          blocks: [
            {
              id: 'block-1',
              type: 'paragraph',
              spans: [{ text: 'Training review description' }],
            },
          ],
        },
        defaultTimeRange: '14d',
        type: 'timeRange',
        version: 1,
        dashboard: {
          kind: 'Dashboard',
          schemaVersion: 'veno.dashboard.v1',
          spec: {
            uid: 'training-review',
            title: 'Stale settings title',
            timeSettings: {
              autoRefresh: '',
              autoRefreshIntervals: ['5s'],
            },
            elements: {},
            layout: {
              kind: 'GridLayout',
              spec: {
                items: [],
              },
            },
          },
        },
      },
    });
    mocks.fetchDashboardSettings.mockResolvedValue({
      dashboardSettings: {
        version: 1,
        dashboard: {
          kind: 'Dashboard',
          schemaVersion: 'veno.dashboard-settings.v2',
          spec: {
            uid: 'training-review',
            title: 'Training review',
            timeSettings: {
              autoRefresh: '',
              autoRefreshIntervals: ['5s'],
            },
            elements: {
              'panel-time-in-range': {
                kind: 'Panel',
                spec: {
                  id: 103,
                  title: 'Time in Range',
                  vizConfig: {
                    kind: 'VizConfig',
                    group: 'veno.time-in-range',
                    version: 'v1',
                    spec: {
                      options: { layout: 'statistics' },
                      fieldConfig: { defaults: {}, overrides: [] },
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
                      height: 7,
                      element: {
                        kind: 'ElementReference',
                        name: 'panel-time-in-range',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    });

    const { loadDashboardResource } = await import('@/lib/dashboard/resources');
    const result = await loadDashboardResource('training-review');

    expect(mocks.fetchDashboardSettings).toHaveBeenCalledWith('training-review');
    expect(result.dashboard.spec.elements['panel-time-in-range']).toBeDefined();
    expect(result.dashboard.spec.title).toBe('Training review renamed');
    expect(result.defaultTimeRange).toBe('14d');
    expect(result.description).toEqual({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [{ text: 'Training review description' }],
        },
      ],
    });
    expect(result.dashboard.spec.layout.spec.items).toHaveLength(1);
    expect(result.version).toBe(1);
  });

  test('rejects public dashboard resources with incompatible panels', async () => {
    mocks.fetchDashboardResource.mockResolvedValue({
      dashboard: {
        uid: 'bad-live-dashboard',
        title: 'Bad Live Dashboard',
        description: null,
        type: 'live',
        version: 1,
        dashboard: {
          kind: 'Dashboard',
          schemaVersion: 'veno.dashboard.v1',
          spec: {
            uid: 'bad-live-dashboard',
            title: 'Bad Live Dashboard',
            timeSettings: {
              autoRefresh: '',
              autoRefreshIntervals: ['5s'],
            },
            elements: {
              'panel-time-in-range': {
                kind: 'Panel',
                spec: {
                  id: 3,
                  title: 'Time in Range',
                  vizConfig: {
                    kind: 'VizConfig',
                    group: 'veno.time-in-range',
                    version: 'v1',
                    spec: {
                      options: {},
                      fieldConfig: { defaults: {}, overrides: [] },
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
                        name: 'panel-time-in-range',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    });

    const { loadDashboardResource } = await import('@/lib/dashboard/resources');

    await expect(loadDashboardResource('bad-live-dashboard')).rejects.toThrow(
      'Panel "panel-time-in-range" is not compatible with live dashboards.',
    );
  });

  test('rejects when the public dashboard resource cannot be reached', async () => {
    mocks.fetchDashboardResource.mockRejectedValue(new Error('fetch failed'));

    const { loadDashboardResource } = await import('@/lib/dashboard/resources');

    await expect(loadDashboardResource('overview')).rejects.toThrow('fetch failed');
  });
});
