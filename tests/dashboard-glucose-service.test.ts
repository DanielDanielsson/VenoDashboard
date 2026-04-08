import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createDashboardGlucoseService, type GlucoseTimelinePort, type HealthStepsPort, type TandemActivityPort } from '@/lib/glucose/dashboard-service';
import type { PulseApiReading } from '@/lib/pulse-api/types';

function reading(overrides: Partial<PulseApiReading> = {}): PulseApiReading {
  return {
    id: overrides.id ?? 'reading-1',
    timestamp: overrides.timestamp ?? '2026-03-07T10:00:00.000Z',
    valueMmolL: overrides.valueMmolL ?? 5.5,
    valueMgDl: overrides.valueMgDl ?? 99,
    trend: overrides.trend ?? 'flat',
    originalValueMmolL: overrides.originalValueMmolL ?? null,
    originalValueMgDl: overrides.originalValueMgDl ?? null,
    isCorrected: overrides.isCorrected ?? false,
    correctionReason: overrides.correctionReason ?? null,
    status: overrides.status,
    source: overrides.source
  };
}

describe('dashboard glucose service', () => {
  let glucosePort: GlucoseTimelinePort;
  let tandemPort: TandemActivityPort;
  let healthPort: HealthStepsPort;

  beforeEach(() => {
    glucosePort = {
      fetchLatest: vi.fn().mockResolvedValue(null),
      fetchHistory: vi.fn().mockResolvedValue([])
    };
    tandemPort = {
      fetchBasal: vi.fn().mockResolvedValue([]),
      fetchEvents: vi.fn().mockResolvedValue([])
    };
    healthPort = {
      fetchSteps: vi.fn().mockResolvedValue([])
    };
  });

  test('getLatest prefers an available share reading over an unavailable official placeholder', async () => {
    const share = reading({
      id: 'share-1',
      timestamp: '2026-03-07T10:02:00.000Z',
      valueMmolL: 6.2,
      valueMgDl: 112,
      originalValueMmolL: 7.1,
      originalValueMgDl: 128,
      isCorrected: true,
      correctionReason: 'Sensor compression low'
    });

    vi.mocked(glucosePort.fetchLatest)
      .mockResolvedValueOnce(
        reading({
          id: 'official-1',
          status: 'unavailable',
          valueMmolL: 0,
          valueMgDl: 0,
          trend: 'unknown'
        })
      )
      .mockResolvedValueOnce(share);

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      clock: () => new Date('2026-03-07T10:05:00.000Z')
    });

    await expect(service.getLatest()).resolves.toEqual({
      id: 'share-1',
      timestamp: '2026-03-07T10:02:00.000Z',
      valueMmolL: 6.2,
      valueMgDl: 112,
      trend: 'flat',
      source: 'share',
      originalValueMmolL: 7.1,
      originalValueMgDl: 128,
      isCorrected: true,
      correctionReason: 'Sensor compression low'
    });
  });

  test('getHistory preserves the latest-only fast path for default requests with limit=1', async () => {
    vi.mocked(glucosePort.fetchLatest)
      .mockResolvedValueOnce(reading({ id: 'official-1' }))
      .mockResolvedValueOnce(null);

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      clock: () => new Date('2026-03-07T10:00:00.000Z')
    });

    const response = await service.getHistory({ limit: 1 });

    expect(response.items).toEqual([
      expect.objectContaining({
        readingId: 'official-1',
        timestamp: '2026-03-07T10:00:00.000Z',
        source: 'official'
      })
    ]);
    expect(response.meta).toEqual({
      from: '2026-03-06T10:00:00.000Z',
      to: '2026-03-07T10:00:00.000Z',
      officialCount: 1,
      shareCount: 0,
      mergedCount: 1,
      tandemBasalCount: 0,
      tandemEventCount: 0,
      healthStepCount: 0
    });
    expect(glucosePort.fetchHistory).not.toHaveBeenCalled();
    expect(tandemPort.fetchBasal).not.toHaveBeenCalled();
    expect(tandemPort.fetchEvents).not.toHaveBeenCalled();
    expect(healthPort.fetchSteps).not.toHaveBeenCalled();
  });

  test('getHistory resolves preset windows, chunks large ranges, and returns merged counts', async () => {
    vi.mocked(glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(glucosePort.fetchHistory).mockImplementation(async (source, window) => {
      if (source === 'official') {
        return [
          reading({
            id: `official-${window.from}`,
            timestamp: window.from,
            valueMmolL: 5.1,
            valueMgDl: 92
          })
        ];
      }

      return [
        reading({
          id: `share-${window.to}`,
          timestamp: new Date(new Date(window.to).getTime() - 5 * 60 * 1000).toISOString(),
          valueMmolL: 5.9,
          valueMgDl: 106
        })
      ];
    });
    vi.mocked(tandemPort.fetchBasal).mockImplementation(async (window) => {
      const day = new Date(window.from).getUTCDate();
      return [
        {
          timestamp: window.from,
          basalRateUnitsPerHour: 0.5 + day / 10,
          eventName: 'BasalDelivery',
          localTimestamp: '2026-03-07T10:00:00',
          pumpTimeZone: 'Europe/Stockholm'
        }
      ];
    });
    vi.mocked(tandemPort.fetchEvents).mockImplementation(async (window) => [
      {
        timestamp: window.from,
        eventName: 'BolusDelivery',
        localTimestamp: '2026-03-07T10:00:00',
        pumpTimeZone: 'Europe/Stockholm',
        insulinDelivered: 2.4,
        insulinRequested: null,
        iob: null,
        carbsGrams: null,
        glucoseMmolL: null
      }
    ]);
    vi.mocked(healthPort.fetchSteps).mockResolvedValue([
      {
        bucketStart: '2026-03-01T00:00:00.000Z',
        bucketEnd: '2026-03-01T00:05:00.000Z',
        stepCount: 120,
        source: 'apple_health'
      }
    ]);

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      clock: () => new Date('2026-03-04T00:00:00.000Z')
    });

    const response = await service.getHistory({ range: '3d' });

    expect(glucosePort.fetchHistory).toHaveBeenCalledTimes(4);
    expect(tandemPort.fetchBasal).toHaveBeenCalledTimes(3);
    expect(tandemPort.fetchEvents).toHaveBeenCalledTimes(3);
    expect(response.meta.officialCount).toBe(2);
    expect(response.meta.shareCount).toBe(2);
    expect(response.meta.mergedCount).toBe(4);
    expect(response.meta.tandemBasalCount).toBe(3);
    expect(response.meta.tandemEventCount).toBe(3);
    expect(response.meta.healthStepCount).toBe(1);
  });

  test('getUpdatesSince counts glucose and tandem updates using the service boundary', async () => {
    vi.mocked(glucosePort.fetchLatest)
      .mockResolvedValueOnce(reading({ id: 'official-latest', timestamp: '2026-03-07T07:20:00.000Z' }))
      .mockResolvedValueOnce(null);
    vi.mocked(glucosePort.fetchHistory).mockImplementation(async (source) => {
      if (source === 'official') {
        return [
          reading({
            id: 'official-1',
            timestamp: '2026-03-07T07:15:00.000Z',
            valueMmolL: 5.4,
            valueMgDl: 97
          })
        ];
      }

      return [
        reading({
          id: 'share-1',
          timestamp: '2026-03-07T07:20:00.000Z',
          valueMmolL: 5.7,
          valueMgDl: 103
        })
      ];
    });
    vi.mocked(tandemPort.fetchBasal).mockResolvedValue([
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
    ]);
    vi.mocked(tandemPort.fetchEvents).mockResolvedValue([
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
    ]);

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      clock: () => new Date('2026-03-07T07:20:00.000Z')
    });

    const response = await service.getUpdatesSince('2026-03-07T07:10:00.000Z');

    expect(response.meta.newCount).toBe(4);
    expect(response.meta.newGlucoseCount).toBe(2);
    expect(response.meta.newTandemBasalCount).toBe(1);
    expect(response.meta.newTandemEventCount).toBe(1);
  });

  test('getHistory throws when both glucose history sources fail', async () => {
    vi.mocked(glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(glucosePort.fetchHistory)
      .mockRejectedValueOnce(new Error('Glucose history (official) failed with status 403'))
      .mockRejectedValueOnce(new Error('Glucose history (share) failed with status 403'));

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      clock: () => new Date('2026-03-07T10:00:00.000Z')
    });

    await expect(
      service.getHistory({
        from: '2026-03-06T10:00:00.000Z',
        to: '2026-03-07T10:00:00.000Z'
      })
    ).rejects.toThrow(
      'Failed to load glucose history: Glucose history (official) failed with status 403 | Glucose history (share) failed with status 403'
    );
  });

  test('getHistory still returns merged data when one glucose source fails', async () => {
    vi.mocked(glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(glucosePort.fetchHistory).mockImplementation(async (source) => {
      if (source === 'official') {
        throw new Error('Glucose history (official) failed with status 403');
      }

      return [
        reading({
          id: 'share-1',
          timestamp: '2026-03-07T09:55:00.000Z',
          valueMmolL: 5.9,
          valueMgDl: 106
        })
      ];
    });

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      clock: () => new Date('2026-03-07T10:00:00.000Z')
    });

    const response = await service.getHistory({
      from: '2026-03-06T10:00:00.000Z',
      to: '2026-03-07T10:00:00.000Z'
    });

    expect(response.items).toHaveLength(1);
    expect(response.latest).toEqual(
      expect.objectContaining({
        id: 'share-1',
        source: 'share'
      })
    );
  });
});
