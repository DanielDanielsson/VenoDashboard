import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const updateDashboardMetadata = vi.fn();

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
  updateDashboardMetadata,
}));

describe('dashboard rename route', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    updateDashboardMetadata.mockReset();
  });

  test('denies public dashboard renames', async () => {
    getOwnerSession.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/dashboard/dashboards/[dashboardUid]/route');
    const response = await PATCH(new NextRequest('http://localhost/api/dashboard/dashboards/overview', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Daily Overview',
        expectedVersion: 1,
      }),
    }), {
      params: Promise.resolve({ dashboardUid: 'overview' }),
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Unauthorized');
    expect(updateDashboardMetadata).not.toHaveBeenCalled();
  });

  test('renames admin dashboards through VenoAPI', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    updateDashboardMetadata.mockResolvedValue({
      dashboard: {
        uid: 'overview',
        title: 'Daily Overview',
        description: null,
        type: 'live',
        version: 2,
        dashboard: {},
      },
    });

    const { PATCH } = await import('@/app/api/dashboard/dashboards/[dashboardUid]/route');
    const response = await PATCH(new NextRequest('http://localhost/api/dashboard/dashboards/overview', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Daily Overview',
        description: null,
        expectedVersion: 1,
      }),
    }), {
      params: Promise.resolve({ dashboardUid: 'overview' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.dashboard.title).toBe('Daily Overview');
    expect(updateDashboardMetadata).toHaveBeenCalledWith('overview', {
      title: 'Daily Overview',
      description: null,
      expectedVersion: 1,
    });
  });
});
