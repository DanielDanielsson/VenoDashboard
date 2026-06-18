import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fetchGlucoseReadingsSeries = vi.fn();
const fetchGlucoseHistory = vi.fn();
const mergeGlucoseReadings = vi.fn();

vi.mock('@/lib/veno-api/glucose', () => ({
  fetchGlucoseReadingsSeries,
  fetchGlucoseHistory,
  mergeGlucoseReadings
}));

describe('dashboard glucose readings series route', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchGlucoseReadingsSeries.mockReset();
    fetchGlucoseHistory.mockReset();
    mergeGlucoseReadings.mockReset();
  });

  test('proxies optimized glucose readings series requests through VenoAPI', async () => {
    const payload = {
      items: [
        {
          readingId: 'official-1',
          timestamp: '2026-03-07T10:00:00.000Z',
          valueMmolL: 6.1,
          valueMgDl: 110,
          trend: 'flat',
          source: 'official'
        }
      ],
      meta: {
        from: '2026-03-07T10:00:00.000Z',
        to: '2026-03-07T10:15:00.000Z',
        officialCount: 1,
        shareCount: 0,
        returned: 1,
        source: 'official',
        resolution: {
          mode: 'raw',
          intervalMs: 60_000,
          maxDataPoints: 320,
          returnedPoints: 1
        },
        capabilities: {
          correctionsAllowed: true
        }
      }
    };
    fetchGlucoseReadingsSeries.mockResolvedValue(payload);

    const { GET } = await import('@/app/api/dashboard/glucose/readings-series/route');
    const response = await GET(new NextRequest(
      'http://localhost/api/dashboard/glucose/readings-series?from=2026-03-07T10:00:00.000Z&to=2026-03-07T10:15:00.000Z&maxDataPoints=320&intervalMs=61000'
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetchGlucoseReadingsSeries).toHaveBeenCalledWith({
      from: '2026-03-07T10:00:00.000Z',
      to: '2026-03-07T10:15:00.000Z',
      maxDataPoints: 320,
      intervalMs: 61000
    });
    expect(json).toEqual(payload);
  });

  test('rejects invalid resolution parameters before proxying', async () => {
    const { GET } = await import('@/app/api/dashboard/glucose/readings-series/route');
    const response = await GET(new NextRequest(
      'http://localhost/api/dashboard/glucose/readings-series?from=2026-03-07T10:00:00.000Z&to=2026-03-07T10:15:00.000Z&maxDataPoints=wide&intervalMs=0'
    ));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json.error.message).toContain('maxDataPoints');
    expect(fetchGlucoseReadingsSeries).not.toHaveBeenCalled();
  });

  test('falls back to existing glucose history when VenoAPI has not deployed the optimized series route yet', async () => {
    const error = new Error('Glucose readings series failed with status 404') as Error & { status: number };
    error.status = 404;
    fetchGlucoseReadingsSeries.mockRejectedValue(error);
    fetchGlucoseHistory
      .mockResolvedValueOnce({
        items: [
          {
            id: 'official-1',
            timestamp: '2026-03-07T10:00:00.000Z',
            valueMmolL: 6.1,
            valueMgDl: 110,
            trend: 'flat'
          }
        ],
        meta: {
          returned: 1
        }
      })
      .mockResolvedValueOnce({
        items: [],
        meta: {
          returned: 0
        }
      });
    mergeGlucoseReadings.mockReturnValue([
      {
        readingId: 'official-1',
        timestamp: '2026-03-07T10:00:00.000Z',
        valueMmolL: 6.1,
        valueMgDl: 110,
        trend: 'flat',
        source: 'official'
      }
    ]);

    const { GET } = await import('@/app/api/dashboard/glucose/readings-series/route');
    const response = await GET(new NextRequest(
      'http://localhost/api/dashboard/glucose/readings-series?from=2026-03-07T10:00:00.000Z&to=2026-03-07T10:15:00.000Z&maxDataPoints=320'
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(fetchGlucoseHistory).toHaveBeenCalledWith(
      'official',
      '2026-03-07T10:00:00.000Z',
      '2026-03-07T10:15:00.000Z',
      1000
    );
    expect(fetchGlucoseHistory).toHaveBeenCalledWith(
      'share',
      '2026-03-07T10:00:00.000Z',
      '2026-03-07T10:15:00.000Z',
      1000
    );
    expect(json).toEqual({
      items: [
        {
          readingId: 'official-1',
          timestamp: '2026-03-07T10:00:00.000Z',
          valueMmolL: 6.1,
          valueMgDl: 110,
          trend: 'flat',
          source: 'official',
          originalValueMmolL: null,
          originalValueMgDl: null,
          isCorrected: false,
          correctionReason: null
        }
      ],
      meta: {
        from: '2026-03-07T10:00:00.000Z',
        to: '2026-03-07T10:15:00.000Z',
        officialCount: 1,
        shareCount: 0,
        returned: 1,
        source: 'official',
        resolution: {
          mode: 'raw',
          intervalMs: 11250,
          maxDataPoints: 320,
          returnedPoints: 1
        },
        capabilities: {
          correctionsAllowed: true
        }
      }
    });
  });
});
