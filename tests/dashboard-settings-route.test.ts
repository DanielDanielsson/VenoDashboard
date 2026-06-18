import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const saveDashboardSettings = vi.fn();
const fetchDashboardSettings = vi.fn();
const loadDashboardResource = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOwnerSession,
}));

vi.mock('@/lib/veno-api/client', () => ({
  VenoApiClientError: class VenoApiClientError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  saveDashboardSettings,
  fetchDashboardSettings,
}));

vi.mock('@/lib/dashboard/resources', () => ({
  loadDashboardResource,
}));

function createPanel(id: number, title: string, group: string, options: Record<string, unknown> = {}) {
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

describe('dashboard settings route', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    saveDashboardSettings.mockReset();
    fetchDashboardSettings.mockReset();
    loadDashboardResource.mockReset();
    loadDashboardResource.mockResolvedValue({
      dashboard: {
        schemaVersion: 'veno.dashboard.v1',
        kind: 'Dashboard',
        spec: {
          uid: 'statistics',
          title: 'Statistics',
          timeSettings: {
            autoRefresh: '',
            autoRefreshIntervals: ['5s', '10s', '1m'],
          },
          elements: {
            'panel-time-in-range': createPanel(103, 'Time in Range', 'veno.time-in-range', { layout: 'statistics' }),
            'panel-glucose-timeline': createPanel(104, 'Glucose Timeline', 'veno.glucose-timeline'),
          },
          layout: {
            kind: 'GridLayout',
            spec: {
              items: [],
            },
          },
        },
      },
      type: 'timeRange',
      version: 3,
      source: 'api',
    });
  });

  test('denies public dashboard settings loads', async () => {
    getOwnerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/dashboard/settings/dashboards/[dashboardUid]/route');
    const response = await GET(
      new NextRequest('http://localhost/api/dashboard/settings/dashboards/statistics', {
        method: 'GET',
      }),
      { params: Promise.resolve({ dashboardUid: 'statistics' }) },
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Unauthorized');
    expect(fetchDashboardSettings).not.toHaveBeenCalled();
  });

  test('loads admin dashboard settings through VenoAPI', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    fetchDashboardSettings.mockResolvedValue({
      dashboardSettings: {
        dashboardUid: 'statistics',
        schemaVersion: 'veno.dashboard-settings.v2',
        version: 4,
        dashboard: {},
        updatedAt: '2026-04-19T08:00:00.000Z',
        updatedBy: {
          actor: 'admin',
          apiKeyId: null,
          apiKeyName: null,
        },
      },
    });

    const { GET } = await import('@/app/api/dashboard/settings/dashboards/[dashboardUid]/route');
    const response = await GET(
      new NextRequest('http://localhost/api/dashboard/settings/dashboards/statistics', {
        method: 'GET',
      }),
      { params: Promise.resolve({ dashboardUid: 'statistics' }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.dashboardSettings.version).toBe(4);
    expect(fetchDashboardSettings).toHaveBeenCalledWith('statistics');
  });

  test('denies public dashboard settings saves', async () => {
    getOwnerSession.mockResolvedValue(null);

    const { PUT } = await import('@/app/api/dashboard/settings/dashboards/[dashboardUid]/route');
    const response = await PUT(
      new NextRequest('http://localhost/api/dashboard/settings/dashboards/statistics', {
        method: 'PUT',
        body: JSON.stringify({
          panelSettings: {
            'panel-time-in-range': { layout: 'overview' },
          },
        }),
      }),
      { params: Promise.resolve({ dashboardUid: 'statistics' }) },
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Unauthorized');
    expect(saveDashboardSettings).not.toHaveBeenCalled();
  });

  test('saves admin dashboard state through VenoAPI dashboard settings contract', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    fetchDashboardSettings.mockResolvedValue({
      dashboardSettings: {
        dashboardUid: 'statistics',
        schemaVersion: 'veno.dashboard-settings.v2',
        version: 3,
        dashboard: {},
        updatedAt: '2026-04-19T08:00:00.000Z',
        updatedBy: {
          actor: 'admin',
          apiKeyId: null,
          apiKeyName: null,
        },
      },
    });
    saveDashboardSettings.mockResolvedValue({
      dashboardSettings: {
        dashboardUid: 'statistics',
        schemaVersion: 'veno.dashboard-settings.v2',
        version: 4,
        dashboard: {},
        updatedAt: '2026-04-19T08:00:00.000Z',
        updatedBy: {
          actor: 'admin',
          apiKeyId: null,
          apiKeyName: null,
        },
      },
    });

    const { PUT } = await import('@/app/api/dashboard/settings/dashboards/[dashboardUid]/route');
    const response = await PUT(
      new NextRequest('http://localhost/api/dashboard/settings/dashboards/statistics', {
        method: 'PUT',
        body: JSON.stringify({
          expectedVersion: 3,
          layout: [
            {
              element: 'panel-time-in-range',
              x: 0,
              y: 0,
              width: 4,
              height: 7,
            },
            {
              element: 'panel-glucose-timeline',
              x: 4,
              y: 0,
              width: 8,
              height: 9,
            },
            {
              element: 'panel-extra',
              x: 0,
              y: 9,
              width: 4,
              height: 6,
            },
          ],
          elements: {
            'panel-time-in-range': createPanel(103, 'Time in Range', 'veno.time-in-range', { layout: 'statistics' }),
            'panel-glucose-timeline': createPanel(104, 'Glucose Timeline', 'veno.glucose-timeline'),
            'panel-extra': createPanel(999, 'Extra Panel', 'veno.time-in-range', { layout: 'statistics' }),
          },
          panelSettings: {
            'panel-time-in-range': { layout: 'overview' },
            'panel-glucose-timeline': { colorMode: 'gradient', yAxisMax: 18 },
          },
          timeSettings: {
            autoRefresh: '10s',
            autoRefreshIntervals: ['5s', '10s', '1m'],
          },
        }),
      }),
      { params: Promise.resolve({ dashboardUid: 'statistics' }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.dashboardSettings.version).toBe(4);
    expect(fetchDashboardSettings).toHaveBeenCalledWith('statistics');
    expect(saveDashboardSettings).toHaveBeenCalledWith(
      'statistics',
      expect.objectContaining({
        expectedVersion: 3,
        dashboard: expect.objectContaining({
          schemaVersion: 'veno.dashboard-settings.v2',
          spec: expect.objectContaining({
            uid: 'statistics',
            timeSettings: {
              autoRefresh: '10s',
              autoRefreshIntervals: ['5s', '10s', '1m'],
            },
            layout: expect.objectContaining({
              spec: expect.objectContaining({
                items: expect.arrayContaining([
                  expect.objectContaining({
                    spec: expect.objectContaining({
                      x: 0,
                      y: 0,
                      width: 4,
                      height: 7,
                      element: expect.objectContaining({
                        name: 'panel-time-in-range',
                      }),
                    }),
                  }),
                  expect.objectContaining({
                    spec: expect.objectContaining({
                      x: 4,
                      y: 0,
                      width: 8,
                      height: 9,
                      element: expect.objectContaining({
                        name: 'panel-glucose-timeline',
                      }),
                    }),
                  }),
                ]),
              }),
            }),
            elements: expect.objectContaining({
              'panel-time-in-range': expect.objectContaining({
                spec: expect.objectContaining({
                  vizConfig: expect.objectContaining({
                    spec: expect.objectContaining({
                      options: expect.objectContaining({ layout: 'overview' }),
                    }),
                  }),
                }),
              }),
              'panel-glucose-timeline': expect.objectContaining({
                spec: expect.objectContaining({
                  vizConfig: expect.objectContaining({
                    spec: expect.objectContaining({
                      options: expect.objectContaining({ colorMode: 'gradient', yAxisMax: 18 }),
                    }),
                  }),
                }),
              }),
              'panel-extra': expect.objectContaining({
                spec: expect.objectContaining({
                  title: 'Extra Panel',
                  vizConfig: expect.objectContaining({
                    group: 'veno.time-in-range',
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });

  test('saves custom dashboard state using the current API dashboard as the base document', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    fetchDashboardSettings.mockRejectedValue(Object.assign(new Error('Dashboard settings were not found.'), {
      status: 404,
    }));
    loadDashboardResource.mockResolvedValue({
      dashboard: {
        schemaVersion: 'veno.dashboard.v1',
        kind: 'Dashboard',
        spec: {
          uid: 'training-review',
          title: 'Training review',
          timeSettings: {
            autoRefresh: '',
            autoRefreshIntervals: ['5s', '10s', '1m'],
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
      type: 'timeRange',
      version: 7,
      source: 'api',
    });
    saveDashboardSettings.mockResolvedValue({
      dashboardSettings: {
        dashboardUid: 'training-review',
        schemaVersion: 'veno.dashboard-settings.v2',
        version: 8,
        dashboard: {},
        updatedAt: '2026-04-19T08:00:00.000Z',
        updatedBy: {
          actor: 'admin',
          apiKeyId: null,
          apiKeyName: null,
        },
      },
    });

    const { PUT } = await import('@/app/api/dashboard/settings/dashboards/[dashboardUid]/route');
    const response = await PUT(
      new NextRequest('http://localhost/api/dashboard/settings/dashboards/training-review', {
        method: 'PUT',
        body: JSON.stringify({
          expectedVersion: 7,
          elements: {
            'panel-time-in-range': createPanel(103, 'Time in Range', 'veno.time-in-range', { layout: 'statistics' }),
          },
          layout: [
            {
              element: 'panel-time-in-range',
              x: 0,
              y: 0,
              width: 4,
              height: 7,
            },
          ],
        }),
      }),
      { params: Promise.resolve({ dashboardUid: 'training-review' }) },
    );

    expect(response.status).toBe(200);
    expect(loadDashboardResource).toHaveBeenCalledWith('training-review');
    expect(fetchDashboardSettings).toHaveBeenCalledWith('training-review');
    expect(saveDashboardSettings).toHaveBeenCalledWith(
      'training-review',
      expect.objectContaining({
        expectedVersion: null,
        dashboard: expect.objectContaining({
          schemaVersion: 'veno.dashboard-settings.v2',
          kind: 'Dashboard',
          spec: expect.objectContaining({
            uid: 'training-review',
            title: 'Training review',
            elements: expect.objectContaining({
              'panel-time-in-range': expect.any(Object),
            }),
          }),
        }),
      }),
    );
  });
});
