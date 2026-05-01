import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const deleteDashboard = vi.fn();

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
  deleteDashboard,
}));

describe('dashboard delete route', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    deleteDashboard.mockReset();
  });

  test('denies public dashboard deletes', async () => {
    getOwnerSession.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/dashboard/dashboards/[dashboardUid]/route');
    const response = await DELETE(new NextRequest('http://localhost/api/dashboard/dashboards/night-view', {
      method: 'DELETE',
    }), {
      params: Promise.resolve({ dashboardUid: 'night-view' }),
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Unauthorized');
    expect(deleteDashboard).not.toHaveBeenCalled();
  });

  test('deletes admin dashboards through VenoAPI', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    deleteDashboard.mockResolvedValue({
      dashboardUid: 'night-view',
      preferences: {
        homeDashboardUid: 'overview',
        pinnedDashboardUids: [],
      },
    });

    const { DELETE } = await import('@/app/api/dashboard/dashboards/[dashboardUid]/route');
    const response = await DELETE(new NextRequest('http://localhost/api/dashboard/dashboards/night-view', {
      method: 'DELETE',
    }), {
      params: Promise.resolve({ dashboardUid: 'night-view' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.dashboardUid).toBe('night-view');
    expect(deleteDashboard).toHaveBeenCalledWith('night-view');
  });
});
