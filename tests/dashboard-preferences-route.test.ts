import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const saveDashboardPreferences = vi.fn();

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
  saveDashboardPreferences,
}));

describe('dashboard preferences route', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    saveDashboardPreferences.mockReset();
  });

  test('denies public dashboard preference saves', async () => {
    getOwnerSession.mockResolvedValue(null);

    const { PUT } = await import('@/app/api/dashboard/preferences/route');
    const response = await PUT(new NextRequest('http://localhost/api/dashboard/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        homeDashboardUid: 'overview',
        pinnedDashboardUids: ['statistics'],
        dashboardOrderUids: ['statistics', 'overview'],
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Unauthorized');
    expect(saveDashboardPreferences).not.toHaveBeenCalled();
  });

  test('saves admin dashboard preferences through VenoAPI', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    saveDashboardPreferences.mockResolvedValue({
      preferences: {
        homeDashboardUid: 'overview',
        pinnedDashboardUids: ['statistics', 'overview'],
        dashboardOrderUids: ['statistics', 'overview'],
      },
    });

    const { PUT } = await import('@/app/api/dashboard/preferences/route');
    const response = await PUT(new NextRequest('http://localhost/api/dashboard/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        homeDashboardUid: 'overview',
        pinnedDashboardUids: ['statistics', 'overview'],
        dashboardOrderUids: ['statistics', 'overview'],
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.preferences.pinnedDashboardUids).toEqual(['statistics', 'overview']);
    expect(saveDashboardPreferences).toHaveBeenCalledWith({
      homeDashboardUid: 'overview',
      pinnedDashboardUids: ['statistics', 'overview'],
      dashboardOrderUids: ['statistics', 'overview'],
    });
  });
});
