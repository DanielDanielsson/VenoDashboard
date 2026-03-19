import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const fetchLatestDashboardReading = vi.fn();
const fetchMergedGlucoseWindow = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOwnerSession
}));

vi.mock('@/lib/glucose/dashboard-data', () => ({
  fetchLatestDashboardReading,
  fetchMergedGlucoseWindow
}));

describe('dashboard glucose updates route', () => {
  beforeEach(() => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('returns a count of new glucose and tandem updates since the displayed latest timestamp', async () => {
    fetchLatestDashboardReading.mockResolvedValue({
      timestamp: '2026-03-07T07:20:00.000Z',
      valueMmolL: 5.7,
      valueMgDl: 103,
      trend: 'flat',
      source: 'share'
    });
    fetchMergedGlucoseWindow.mockResolvedValue({
      merged: [
        { timestamp: '2026-03-07T07:15:00.000Z', valueMmolL: 5.4, valueMgDl: 97, trend: 'flat', source: 'official' },
        { timestamp: '2026-03-07T07:20:00.000Z', valueMmolL: 5.7, valueMgDl: 103, trend: 'flat', source: 'share' }
      ],
      tandemBasalItems: [
        {
          timestamp: '2026-03-07T07:09:00.000Z',
          basalRateUnitsPerHour: 0.7,
          eventName: 'BasalDelivery',
          localTimestamp: '2026-03-07T08:09:00',
          pumpTimeZone: 'Europe/Stockholm'
        },
        {
          timestamp: '2026-03-07T07:18:00.000Z',
          basalRateUnitsPerHour: 0.8,
          eventName: 'BasalRateChange',
          localTimestamp: '2026-03-07T08:18:00',
          pumpTimeZone: 'Europe/Stockholm'
        }
      ],
      tandemEventItems: [
        {
          timestamp: '2026-03-07T07:19:00.000Z',
          eventName: 'BolusDelivery',
          localTimestamp: '2026-03-07T08:19:00',
          pumpTimeZone: 'Europe/Stockholm',
          insulinDelivered: 2.4,
          insulinRequested: null,
          iob: null,
          carbsGrams: null,
          glucoseMmolL: null
        }
      ]
    });

    const { GET } = await import('@/app/api/dashboard/glucose/updates/route');
    const response = await GET(
      new NextRequest('http://localhost/api/dashboard/glucose/updates?since=2026-03-07T07:10:00.000Z')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMergedGlucoseWindow).toHaveBeenCalledTimes(1);
    expect(json.latest).toEqual(
      expect.objectContaining({
        timestamp: '2026-03-07T07:20:00.000Z',
        source: 'share'
      })
    );
    expect(json.meta.newCount).toBe(4);
    expect(json.meta.newGlucoseCount).toBe(2);
    expect(json.meta.newTandemBasalCount).toBe(1);
    expect(json.meta.newTandemEventCount).toBe(1);
  });

  test('rejects missing since', async () => {
    const { GET } = await import('@/app/api/dashboard/glucose/updates/route');
    const response = await GET(new NextRequest('http://localhost/api/dashboard/glucose/updates'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.message).toContain('since');
  });
});
