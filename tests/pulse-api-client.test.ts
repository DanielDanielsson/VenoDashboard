import { afterEach, describe, expect, test, vi } from 'vitest';
import { compressTandemBasalHistory } from '@/lib/pulse-api/glucose';

describe('pulse api client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('sends status token when configured', async () => {
    vi.stubEnv('PULSE_API_BASE_URL', 'https://example.com');
    vi.stubEnv('PULSE_API_STATUS_TOKEN', 'status-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL, init?: RequestInit) => {
        expect(init?.headers).toBeInstanceOf(Headers);
        const headers = init?.headers as Headers;
        expect(headers.get('x-status-token')).toBe('status-token');

        return new Response(
          JSON.stringify({
            generatedAt: '2026-03-06T10:00:00.000Z',
            official: { stable: true, connected: true, latestReading: null, sourceToDbLagMinutes: null, latestReadingAgeMinutes: null },
            share: { stable: true, connected: true, latestReading: null, sourceToDbLagMinutes: null, latestReadingAgeMinutes: null },
            tandem: { stable: false, connected: true, latestReading: null, sourceToDbLagMinutes: null, latestReadingAgeMinutes: null }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );

    const { fetchApiStatus } = await import('@/lib/pulse-api/client');
    const report = await fetchApiStatus();

    expect(report.official.stable).toBe(true);
  });

  test('compressTandemBasalHistory collapses repeated basal deliveries with the same rate', () => {
    expect(
      compressTandemBasalHistory([
        {
          timestamp: '2026-03-12T07:00:00.000Z',
          basalRateUnitsPerHour: 1.23,
          eventName: 'BasalDelivery',
          localTimestamp: '2026-03-12T08:00:00',
          pumpTimeZone: 'Europe/Stockholm'
        },
        {
          timestamp: '2026-03-12T07:05:00.000Z',
          basalRateUnitsPerHour: 1.19,
          eventName: 'BasalDelivery',
          localTimestamp: '2026-03-12T08:05:00',
          pumpTimeZone: 'Europe/Stockholm'
        },
        {
          timestamp: '2026-03-12T07:10:00.000Z',
          basalRateUnitsPerHour: 0.86,
          eventName: 'BasalDelivery',
          localTimestamp: '2026-03-12T08:10:00',
          pumpTimeZone: 'Europe/Stockholm'
        }
      ]).map((item) => ({
        timestamp: item.timestamp,
        rate: item.basalRateUnitsPerHour
      }))
    ).toEqual([
      { timestamp: '2026-03-12T07:00:00.000Z', rate: 1.2 },
      { timestamp: '2026-03-12T07:10:00.000Z', rate: 0.9 }
    ]);
  });
});
