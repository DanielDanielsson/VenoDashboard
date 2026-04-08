import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const workspaceGetUpdatesSince = vi.fn();

vi.mock('@/lib/glucose/dashboard-workspace', () => ({
  dashboardGlucoseWorkspace: {
    getUpdatesSince: workspaceGetUpdatesSince
  }
}));

describe('dashboard glucose updates route', () => {
  beforeEach(() => {
    workspaceGetUpdatesSince.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('passes the since parameter through to the glucose workspace', async () => {
    workspaceGetUpdatesSince.mockResolvedValue({
      latest: {
        id: 'latest-1',
        timestamp: '2026-03-07T07:20:00.000Z',
        valueMmolL: 5.7,
        valueMgDl: 103,
        trend: 'flat',
        source: 'share'
      },
      meta: {
        since: '2026-03-07T07:10:00.000Z',
        to: '2026-03-07T07:20:00.000Z',
        newCount: 4,
        newGlucoseCount: 2,
        newTandemBasalCount: 1,
        newTandemEventCount: 1
      }
    });

    const { GET } = await import('@/app/api/dashboard/glucose/updates/route');
    const response = await GET(
      new NextRequest('http://localhost/api/dashboard/glucose/updates?since=2026-03-07T07:10:00.000Z')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(workspaceGetUpdatesSince).toHaveBeenCalledWith(
      '2026-03-07T07:10:00.000Z',
      expect.any(Date)
    );
    expect(json.meta.newCount).toBe(4);
  });

  test('uses the workspace boundary for updates requests', async () => {
    workspaceGetUpdatesSince.mockResolvedValue({
      latest: {
        id: 'latest-1',
        timestamp: '2026-03-07T07:20:00.000Z',
        valueMmolL: 5.7,
        valueMgDl: 103,
        trend: 'flat',
        source: 'share'
      },
      meta: {
        since: '2026-03-07T07:10:00.000Z',
        to: '2026-03-07T07:20:00.000Z',
        newCount: 4,
        newGlucoseCount: 2,
        newTandemBasalCount: 1,
        newTandemEventCount: 1
      }
    });

    const { GET } = await import('@/app/api/dashboard/glucose/updates/route');
    const response = await GET(
      new NextRequest('http://localhost/api/dashboard/glucose/updates?since=2026-03-07T07:10:00.000Z')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(workspaceGetUpdatesSince).toHaveBeenCalledWith(
      '2026-03-07T07:10:00.000Z',
      expect.any(Date)
    );
    expect(json.meta.newCount).toBe(4);
  });

  test('rejects missing since', async () => {
    const { GET } = await import('@/app/api/dashboard/glucose/updates/route');
    const response = await GET(new NextRequest('http://localhost/api/dashboard/glucose/updates'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.message).toContain('since');
  });
});
