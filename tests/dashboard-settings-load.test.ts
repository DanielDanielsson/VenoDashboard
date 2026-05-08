import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class MockPulseApiClientError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'PulseApiClientError';
      this.status = status;
    }
  }

  return {
    fetchDashboardSettings: vi.fn(),
    PulseApiClientError: MockPulseApiClientError,
  };
});

vi.mock('@/lib/pulse-api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pulse-api/client')>();
  return {
    ...actual,
    fetchDashboardSettings: mocks.fetchDashboardSettings,
    PulseApiClientError: mocks.PulseApiClientError,
  };
});

describe('dashboard settings loading', () => {
  beforeEach(() => {
    mocks.fetchDashboardSettings.mockReset();
  });

  test('uses a persisted dashboard definition when VenoAPI has settings', async () => {
    mocks.fetchDashboardSettings.mockResolvedValue({
      dashboardSettings: {
        dashboardUid: 'statistics',
        schemaVersion: 'veno.dashboard-settings.v2',
        version: 7,
        dashboard: {
          kind: 'Dashboard',
          schemaVersion: 'veno.dashboard-settings.v2',
          spec: {
            uid: 'statistics',
            title: 'Saved Statistics',
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
                      options: { layout: 'overview' },
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
        updatedAt: '2026-04-19T08:00:00.000Z',
        updatedBy: { actor: 'admin', apiKeyId: null, apiKeyName: null },
      },
    });

    const { loadDashboardDefinition } = await import('@/lib/dashboard/settings');
    const result = await loadDashboardDefinition('statistics');

    expect(result.dashboard.spec.title).toBe('Saved Statistics');
    expect(result.version).toBe(7);
    expect(result.dashboard.spec.elements['panel-time-in-range']?.spec.vizConfig.spec.options).toEqual({
      layout: 'overview',
    });
  });

  test('rejects when persisted dashboard settings are missing', async () => {
    mocks.fetchDashboardSettings.mockRejectedValue(
      new mocks.PulseApiClientError(404, 'Dashboard settings were not found.'),
    );

    const { loadDashboardDefinition } = await import('@/lib/dashboard/settings');

    await expect(loadDashboardDefinition('statistics')).rejects.toThrow('Dashboard settings were not found.');
  });

  test('rejects when persisted dashboard settings cannot be reached', async () => {
    mocks.fetchDashboardSettings.mockRejectedValue(new Error('fetch failed'));

    const { loadDashboardDefinition } = await import('@/lib/dashboard/settings');

    await expect(loadDashboardDefinition('statistics')).rejects.toThrow('fetch failed');
  });
});
