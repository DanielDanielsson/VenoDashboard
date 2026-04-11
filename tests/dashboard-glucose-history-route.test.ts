import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getHistory = vi.fn();
const open = vi.fn();

vi.mock('@/lib/glucose/dashboard-service', () => ({
  dashboardGlucoseService: {
    getHistory
  }
}));

vi.mock('@/lib/glucose/dashboard-workspace', () => ({
  dashboardGlucoseWorkspace: {
    open
  }
}));

describe('dashboard glucose history route', () => {
  beforeEach(() => {
    getHistory.mockReset();
    open.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('passes parsed request data to the glucose service', async () => {
    const payload = {
      items: [
        {
          readingId: 'latest-1',
          timestamp: '2026-03-07T10:00:00.000Z',
          valueMmolL: 5.5,
          valueMgDl: 99,
          originalValueMmolL: 6.2,
          originalValueMgDl: 112,
          isCorrected: true,
          correctionReason: 'Sensor compression low',
          trend: 'flat',
          source: 'official'
        }
      ],
      basalItems: [],
      eventItems: [],
      stepItems: [],
      latest: {
        id: 'latest-1',
        timestamp: '2026-03-07T10:00:00.000Z',
        valueMmolL: 5.5,
        valueMgDl: 99,
      originalValueMmolL: 6.2,
      originalValueMgDl: 112,
        isCorrected: true,
        correctionReason: 'Sensor compression low',
        trend: 'flat',
        source: 'official'
      },
      meta: {
        from: '2026-03-06T10:00:00.000Z',
        to: '2026-03-07T10:00:00.000Z',
        officialCount: 1,
        shareCount: 0,
        mergedCount: 1,
        tandemBasalCount: 0,
        tandemEventCount: 0,
        healthStepCount: 0
      }
    };
    getHistory.mockResolvedValue(payload);

    const { GET } = await import('@/app/api/dashboard/glucose/history/route');
    const response = await GET(new NextRequest('http://localhost/api/dashboard/glucose/history?limit=1'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(getHistory).toHaveBeenCalledWith({
      range: null,
      from: null,
      to: null,
      limit: 1,
      now: expect.any(Date)
    });
    expect(json).toEqual(payload);
  });

  test('passes range, window, and limit parameters through to the service', async () => {
    const payload = {
      items: [
        {
          timestamp: '2026-03-07T09:55:00.000Z',
          valueMmolL: 5.4,
          valueMgDl: 97,
          trend: 'flat',
          source: 'official'
        },
        {
          timestamp: '2026-03-07T10:00:00.000Z',
          valueMmolL: 5.8,
          valueMgDl: 104,
          trend: 'up',
          source: 'share'
        }
      ],
      basalItems: [
        {
          timestamp: '2026-03-07T09:45:00.000Z',
          basalRateUnitsPerHour: 0.8,
          eventName: 'BasalDelivery',
          localTimestamp: '2026-03-07T10:45:00',
          pumpTimeZone: 'Europe/Stockholm'
        }
      ],
      eventItems: [
        {
          timestamp: '2026-03-07T09:57:00.000Z',
          eventName: 'BolusDelivery',
          localTimestamp: '2026-03-07T10:57:00',
          pumpTimeZone: 'Europe/Stockholm',
          insulinDelivered: 2.4,
          insulinRequested: null,
          iob: null,
          carbsGrams: null,
          glucoseMmolL: null
        }
      ],
      stepItems: [
        {
          bucketStart: '2026-03-07T09:50:00.000Z',
          bucketEnd: '2026-03-07T09:55:00.000Z',
          stepCount: 120,
          source: 'apple_health'
        }
      ],
      latest: {
        id: 'latest-2',
        timestamp: '2026-03-07T10:10:00.000Z',
        valueMmolL: 5.6,
        valueMgDl: 101,
        trend: 'flat',
        source: 'official'
      },
      meta: {
        from: '2026-03-07T09:00:00.000Z',
        to: '2026-03-07T10:10:00.000Z',
        officialCount: 2,
        shareCount: 1,
        mergedCount: 2,
        tandemBasalCount: 1,
        tandemEventCount: 1,
        healthStepCount: 1
      }
    };
    getHistory.mockResolvedValue(payload);

    const { GET } = await import('@/app/api/dashboard/glucose/history/route');
    const response = await GET(
      new NextRequest(
        'http://localhost/api/dashboard/glucose/history?from=2026-03-07T09:00:00.000Z&to=2026-03-07T10:10:00.000Z&limit=2'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(getHistory).toHaveBeenCalledWith({
      range: null,
      from: '2026-03-07T09:00:00.000Z',
      to: '2026-03-07T10:10:00.000Z',
      limit: 2,
      now: expect.any(Date)
    });
    expect(json).toEqual(payload);
  });

  test('uses the workspace boundary for preset range requests', async () => {
    const snapshot = {
      items: [
        {
          readingId: 'reading-1',
          timestamp: '2026-03-04T00:00:00.000Z',
          valueMmolL: 5.8,
          valueMgDl: 104,
          trend: 'flat',
          source: 'official'
        }
      ],
      basalItems: [],
      eventItems: [],
      stepItems: [],
      latest: {
        id: 'reading-1',
        timestamp: '2026-03-04T00:00:00.000Z',
        valueMmolL: 5.8,
        valueMgDl: 104,
        trend: 'flat',
        source: 'official'
      },
      meta: {
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-04T00:00:00.000Z',
        officialCount: 1,
        shareCount: 0,
        mergedCount: 1,
        tandemBasalCount: 0,
        tandemEventCount: 0,
        healthStepCount: 0
      }
    };
    open.mockResolvedValue({ snapshot });

    const { GET } = await import('@/app/api/dashboard/glucose/history/route');
    const response = await GET(
      new NextRequest('http://localhost/api/dashboard/glucose/history?range=3d')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(open).toHaveBeenCalledWith({
      range: '3d',
      now: expect.any(Date)
    });
    expect(getHistory).not.toHaveBeenCalled();
    expect(json).toEqual(snapshot);
  });

  test('uses the workspace boundary for explicit custom windows without a limit override', async () => {
    const snapshot = {
      items: [
        {
          readingId: 'reading-1',
          timestamp: '2026-03-07T09:55:00.000Z',
          valueMmolL: 5.8,
          valueMgDl: 104,
          trend: 'flat',
          source: 'official'
        }
      ],
      basalItems: [],
      eventItems: [],
      stepItems: [],
      latest: {
        id: 'reading-1',
        timestamp: '2026-03-07T09:55:00.000Z',
        valueMmolL: 5.8,
        valueMgDl: 104,
        trend: 'flat',
        source: 'official'
      },
      meta: {
        from: '2026-03-07T09:00:00.000Z',
        to: '2026-03-07T10:10:00.000Z',
        officialCount: 1,
        shareCount: 0,
        mergedCount: 1,
        tandemBasalCount: 0,
        tandemEventCount: 0,
        healthStepCount: 0
      }
    };
    open.mockResolvedValue({ snapshot });

    const { GET } = await import('@/app/api/dashboard/glucose/history/route');
    const response = await GET(
      new NextRequest(
        'http://localhost/api/dashboard/glucose/history?from=2026-03-07T09:00:00.000Z&to=2026-03-07T10:10:00.000Z'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(open).toHaveBeenCalledWith({
      window: {
        from: '2026-03-07T09:00:00.000Z',
        to: '2026-03-07T10:10:00.000Z'
      },
      now: expect.any(Date)
    });
    expect(getHistory).not.toHaveBeenCalled();
    expect(json).toEqual(snapshot);
  });
});
