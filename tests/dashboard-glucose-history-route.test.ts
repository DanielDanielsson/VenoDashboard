import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const fetchLatestDashboardReading = vi.fn();
const fetchMergedGlucoseWindow = vi.fn();
const parseLimit = vi.fn();
const resolveHistoryWindow = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOwnerSession
}));

vi.mock('@/lib/glucose/dashboard-data', () => ({
  fetchLatestDashboardReading,
  fetchMergedGlucoseWindow,
  parseLimit,
  resolveHistoryWindow
}));

describe('dashboard glucose history route', () => {
  beforeEach(() => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    parseLimit.mockImplementation((value: string | null) => (value ? Number.parseInt(value, 10) : null));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('uses the fast latest-only path when limit=1 and no range is requested', async () => {
    const latest = {
      timestamp: '2026-03-07T10:00:00.000Z',
      valueMmolL: 5.5,
      valueMgDl: 99,
      trend: 'flat',
      source: 'official'
    };
    resolveHistoryWindow.mockReturnValue({
      from: '2026-03-06T10:00:00.000Z',
      to: '2026-03-07T10:00:00.000Z',
      range: null,
      hasExplicitRange: false
    });
    fetchLatestDashboardReading.mockResolvedValue(latest);

    const { GET } = await import('@/app/api/dashboard/glucose/history/route');
    const response = await GET(new NextRequest('http://localhost/api/dashboard/glucose/history?limit=1'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMergedGlucoseWindow).not.toHaveBeenCalled();
    expect(json.latest).toEqual(latest);
    expect(json.items).toEqual([
      expect.objectContaining({
        timestamp: latest.timestamp,
        valueMmolL: latest.valueMmolL,
        source: 'official'
      })
    ]);
    expect(json.basalItems).toEqual([]);
    expect(json.eventItems).toEqual([]);
    expect(json.meta.mergedCount).toBe(1);
    expect(json.meta.tandemBasalCount).toBe(0);
    expect(json.meta.tandemEventCount).toBe(0);
  });

  test('returns sliced merged history and a resilient latest reading for ranged requests', async () => {
    const latest = {
      timestamp: '2026-03-07T10:10:00.000Z',
      valueMmolL: 5.6,
      valueMgDl: 101,
      trend: 'flat',
      source: 'official'
    };
    const merged = [
      { timestamp: '2026-03-07T09:50:00.000Z', valueMmolL: 5.1, valueMgDl: 92, trend: 'flat', source: 'official' },
      { timestamp: '2026-03-07T09:55:00.000Z', valueMmolL: 5.4, valueMgDl: 97, trend: 'flat', source: 'official' },
      { timestamp: '2026-03-07T10:00:00.000Z', valueMmolL: 5.8, valueMgDl: 104, trend: 'up', source: 'share' }
    ];

    resolveHistoryWindow.mockReturnValue({
      from: '2026-03-07T09:00:00.000Z',
      to: '2026-03-07T10:10:00.000Z',
      range: null,
      hasExplicitRange: true
    });
    fetchLatestDashboardReading.mockResolvedValue(latest);
    fetchMergedGlucoseWindow.mockResolvedValue({
      officialItems: merged.filter((item) => item.source === 'official'),
      shareItems: merged.filter((item) => item.source === 'share'),
      tandemBasalItems: [
        {
          timestamp: '2026-03-07T09:45:00.000Z',
          basalRateUnitsPerHour: 0.8,
          eventName: 'BasalDelivery',
          localTimestamp: '2026-03-07T10:45:00',
          pumpTimeZone: 'Europe/Stockholm'
        }
      ],
      tandemEventItems: [
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
      merged
    });

    const { GET } = await import('@/app/api/dashboard/glucose/history/route');
    const response = await GET(
      new NextRequest(
        'http://localhost/api/dashboard/glucose/history?from=2026-03-07T09:00:00.000Z&to=2026-03-07T10:10:00.000Z&limit=2'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMergedGlucoseWindow).toHaveBeenCalledTimes(1);
    expect(json.latest).toEqual(latest);
    expect(json.items).toEqual(merged.slice(-2));
    expect(json.basalItems).toHaveLength(1);
    expect(json.eventItems).toHaveLength(1);
    expect(json.meta.officialCount).toBe(2);
    expect(json.meta.shareCount).toBe(1);
    expect(json.meta.mergedCount).toBe(2);
    expect(json.meta.tandemBasalCount).toBe(1);
    expect(json.meta.tandemEventCount).toBe(1);
  });
});
