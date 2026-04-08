import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getUpdatesSince = vi.fn();

vi.mock('@/lib/glucose/dashboard-service', () => ({
  dashboardGlucoseService: {
    getUpdatesSince
  }
}));

describe('dashboard glucose updates route', () => {
  beforeEach(() => {
    getUpdatesSince.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('passes the since parameter through to the glucose service', async () => {
    getUpdatesSince.mockResolvedValue({
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
    expect(getUpdatesSince).toHaveBeenCalledWith(
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
