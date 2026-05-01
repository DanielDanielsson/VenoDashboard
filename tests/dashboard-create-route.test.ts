import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const createDashboard = vi.fn();

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
}));

describe('dashboard create route', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    createDashboard.mockReset();
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
        type: 'timeRange',
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.dashboard.uid).toBe('night-view');
    expect(createDashboard).toHaveBeenCalledWith({
      title: 'Night view',
      type: 'timeRange',
    });
  });
});
