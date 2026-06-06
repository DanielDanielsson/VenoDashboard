import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const createDashboard = vi.fn();
const deleteDashboard = vi.fn();
const fetchDashboardList = vi.fn();
const saveDashboardSettings = vi.fn();
const updateDashboardMetadata = vi.fn();
const loadDashboardResource = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOwnerSession,
}));

vi.mock('@/lib/pulse-api/client', () => ({
  PulseApiClientError: class PulseApiClientError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  createDashboard,
  deleteDashboard,
  fetchDashboardList,
  saveDashboardSettings,
  updateDashboardMetadata,
}));

vi.mock('@/lib/dashboard/resources', () => ({
  loadDashboardResource,
}));

describe('dashboard create route', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    createDashboard.mockReset();
    deleteDashboard.mockReset();
    fetchDashboardList.mockReset();
    saveDashboardSettings.mockReset();
    updateDashboardMetadata.mockReset();
    loadDashboardResource.mockReset();
  });

  test('denies public dashboard creation', async () => {
    getOwnerSession.mockResolvedValue(null);

    const { POST } = await import('@/app/api/dashboard/dashboards/route');
    const response = await POST(new NextRequest('http://localhost/api/dashboard/dashboards', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Night view',
        type: 'live',
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Unauthorized');
    expect(createDashboard).not.toHaveBeenCalled();
  });

  test('creates admin dashboards through VenoAPI', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    createDashboard.mockResolvedValue({
      dashboard: {
        uid: 'night-view',
        title: 'Night view',
        type: 'timeRange',
        version: 1,
        dashboard: {},
      },
    });

    const { POST } = await import('@/app/api/dashboard/dashboards/route');
    const response = await POST(new NextRequest('http://localhost/api/dashboard/dashboards', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Night view',
        description: null,
        icon: 'activity',
        defaultTimeRange: '7d',
        type: 'timeRange',
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.dashboard.uid).toBe('night-view');
    expect(createDashboard).toHaveBeenCalledWith({
      title: 'Night view',
      description: null,
      icon: 'activity',
      defaultTimeRange: '7d',
      type: 'timeRange',
    });
  });

  test('denies public dashboard duplication', async () => {
    getOwnerSession.mockResolvedValue(null);

    const { POST } = await import('@/app/api/dashboard/dashboards/[dashboardUid]/duplicate/route');
    const response = await POST(
      new NextRequest('http://localhost/api/dashboard/dashboards/statistics/duplicate', {
        method: 'POST',
      }),
      { params: Promise.resolve({ dashboardUid: 'statistics' }) },
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Unauthorized');
    expect(createDashboard).not.toHaveBeenCalled();
    expect(saveDashboardSettings).not.toHaveBeenCalled();
  });

  test('duplicates admin dashboards by copying the resolved dashboard settings document', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    loadDashboardResource.mockResolvedValue({
      dashboard: {
        schemaVersion: 'veno.dashboard-settings.v2',
        kind: 'Dashboard',
        spec: {
          uid: 'statistics',
          title: 'Statistics',
          timeSettings: {
            autoRefresh: '1m',
            autoRefreshIntervals: ['1m', '5m'],
          },
          elements: {
            'panel-time-in-range': {
              kind: 'Panel',
              spec: {
                id: 103,
                title: 'Time in Range',
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
                  group: 'veno.time-in-range',
                  version: 'v1',
                  spec: {
                    options: {
                      layout: 'statistics',
                    },
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
      description: {
        version: 1,
        blocks: [
          {
            id: 'description-1',
            type: 'paragraph',
            spans: [{ text: 'Stats dashboard.' }],
          },
        ],
      },
      icon: 'activity',
      defaultTimeRange: '7d',
      type: 'timeRange',
      version: 3,
      source: 'api',
    });
    fetchDashboardList.mockResolvedValue({
      dashboards: [
        { uid: 'statistics', title: 'Statistics' },
        { uid: 'statistics-copy', title: 'Statistics - copy' },
      ],
    });
    createDashboard.mockResolvedValue({
      dashboard: {
        uid: 'statistics-copy-2',
        title: 'Statistics - copy 2',
        type: 'timeRange',
        version: 1,
        dashboard: {},
      },
    });
    updateDashboardMetadata.mockResolvedValue({
      dashboard: {
        uid: 'statistics-copy-2',
        title: 'Statistics - copy 2',
        description: {
          version: 1,
          blocks: [
            {
              id: 'description-1',
              type: 'paragraph',
              spans: [{ text: 'Stats dashboard.' }],
            },
          ],
        },
        icon: 'activity',
        defaultTimeRange: '7d',
        type: 'timeRange',
        version: 2,
        updatedAt: '2026-05-29T04:20:00.000Z',
        dashboard: {},
      },
    });
    saveDashboardSettings.mockResolvedValue({
      dashboardSettings: {
        dashboardUid: 'statistics-copy-2',
        schemaVersion: 'veno.dashboard-settings.v2',
        version: 1,
        dashboard: {},
        updatedAt: '2026-05-29T04:20:00.000Z',
        updatedBy: {
          actor: 'admin',
          apiKeyId: null,
          apiKeyName: null,
        },
      },
    });

    const { POST } = await import('@/app/api/dashboard/dashboards/[dashboardUid]/duplicate/route');
    const response = await POST(
      new NextRequest('http://localhost/api/dashboard/dashboards/statistics/duplicate', {
        method: 'POST',
      }),
      { params: Promise.resolve({ dashboardUid: 'statistics' }) },
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.dashboard.uid).toBe('statistics-copy-2');
    expect(loadDashboardResource).toHaveBeenCalledWith('statistics');
    expect(createDashboard).toHaveBeenCalledWith({
      title: 'Statistics - copy 2',
      type: 'timeRange',
    });
    expect(updateDashboardMetadata).toHaveBeenCalledWith('statistics-copy-2', {
      title: 'Statistics - copy 2',
      description: {
        version: 1,
        blocks: [
          {
            id: 'description-1',
            type: 'paragraph',
            spans: [{ text: 'Stats dashboard.' }],
          },
        ],
      },
      icon: 'activity',
      defaultTimeRange: '7d',
      expectedVersion: 1,
    });
    expect(saveDashboardSettings).toHaveBeenCalledWith(
      'statistics-copy-2',
      expect.objectContaining({
        expectedVersion: null,
        dashboard: expect.objectContaining({
          schemaVersion: 'veno.dashboard-settings.v2',
          spec: expect.objectContaining({
            uid: 'statistics-copy-2',
            title: 'Statistics - copy 2',
            timeSettings: {
              autoRefresh: '1m',
              autoRefreshIntervals: ['1m', '5m'],
            },
            elements: expect.objectContaining({
              'panel-time-in-range': expect.any(Object),
            }),
          }),
        }),
      }),
    );
    expect(deleteDashboard).not.toHaveBeenCalled();
  });
});
