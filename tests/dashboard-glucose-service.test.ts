import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createDashboardGlucoseService,
  type GlucoseTimelinePort,
  type HealthStepsPort,
  type WorkoutTimelinePort,
  type TandemActivityPort,
  type TimelineNotesPort
} from '@/lib/glucose/dashboard-service';
import type { VenoApiReading } from '@/lib/veno-api/types';

function reading(overrides: Partial<VenoApiReading> = {}): VenoApiReading {
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
  let workoutPort: WorkoutTimelinePort;
  let notesPort: TimelineNotesPort;

  beforeEach(() => {
    glucosePort = {
      fetchLatest: vi.fn().mockResolvedValue(null),
      fetchHistory: vi.fn().mockResolvedValue([]),
      // Reject by default so existing tests exercise the chunked fallback path.
      fetchSeries: vi.fn().mockRejectedValue(new Error('readings-series unavailable'))
    };
    tandemPort = {
      fetchBasal: vi.fn().mockResolvedValue([]),
      fetchEvents: vi.fn().mockResolvedValue([])
    };
    healthPort = {
      fetchSteps: vi.fn().mockResolvedValue([])
    };
    workoutPort = {
      fetchWorkouts: vi.fn().mockResolvedValue([])
    };
    notesPort = {
      fetchNotes: vi.fn().mockResolvedValue([]),
      fetchMutationSummary: vi.fn().mockResolvedValue({
        latestRevision: null,
        newCount: 0
      })
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
      workoutPort,
      notesPort,
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
      workoutPort,
      notesPort,
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
      healthStepCount: 0,
      timelineRevision: '2026-03-07T10:00:00.000Z'
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
      workoutPort,
      notesPort,
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
    expect(response.noteItems).toEqual([]);
  });

  test('getHistory loads glucose through readings-series without touching the chunked history path', async () => {
    vi.mocked(glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(glucosePort.fetchSeries).mockResolvedValue({
      items: [
        {
          readingId: 'official-1',
          timestamp: '2026-03-01T00:00:00.000Z',
          valueMmolL: 5.1,
          valueMgDl: 92,
          trend: 'flat',
          source: 'official'
        },
        {
          timestamp: '2026-03-02T00:00:00.000Z',
          valueMmolL: 9.4,
          valueMgDl: 169,
          trend: 'flat',
          source: 'share'
        }
      ],
      meta: {
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-04T00:00:00.000Z',
        officialCount: 412,
        shareCount: 388,
        returned: 2,
        source: 'merged',
        resolution: {
          mode: 'reduced',
          intervalMs: 600_000,
          maxDataPoints: 800,
          returnedPoints: 2
        },
        capabilities: {
          correctionsAllowed: false
        }
      }
    });

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      workoutPort,
      notesPort,
      clock: () => new Date('2026-03-04T00:00:00.000Z')
    });

    const response = await service.getHistory({ range: '3d', maxDataPoints: 800 });

    expect(glucosePort.fetchSeries).toHaveBeenCalledTimes(1);
    expect(glucosePort.fetchSeries).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      800
    );
    expect(glucosePort.fetchHistory).not.toHaveBeenCalled();
    expect(response.meta.officialCount).toBe(412);
    expect(response.meta.shareCount).toBe(388);
    expect(response.meta.mergedCount).toBe(2);
    expect(response.items.map((item) => item.readingId)).toEqual(['official-1', undefined]);
  });

  test('getHistory bounds the deploy-order fallback to the requested point budget', async () => {
    vi.mocked(glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(glucosePort.fetchHistory).mockImplementation(async (source) => {
      return Array.from({ length: 10 }, (_, index) => reading({
        id: `${source}-${index}`,
        timestamp: new Date(Date.UTC(2026, 2, 1, 0, index * 5)).toISOString(),
        valueMmolL: index === 3 ? 3 : index === 5 ? 14 : 5 + index / 10,
        valueMgDl: index === 3 ? 54 : index === 5 ? 252 : 90 + index,
        source
      }));
    });

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      workoutPort,
      notesPort
    });

    const response = await service.getHistory({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-01T01:00:00.000Z',
      maxDataPoints: 4
    });

    expect(glucosePort.fetchSeries).toHaveBeenCalledTimes(1);
    expect(glucosePort.fetchHistory).toHaveBeenCalledTimes(2);
    expect(response.items).toHaveLength(4);
    expect(response.items.map((item) => item.valueMmolL)).toEqual([5, 3, 14, 5.9]);
    expect(response.meta.officialCount).toBe(10);
    expect(response.meta.shareCount).toBe(10);
    expect(response.meta.mergedCount).toBe(4);
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
    vi.mocked(notesPort.fetchMutationSummary).mockResolvedValue({
      latestRevision: '2026-03-07T07:19:30.000Z',
      newCount: 2
    });

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      workoutPort,
      notesPort,
      clock: () => new Date('2026-03-07T07:20:00.000Z')
    });

    const response = await service.getUpdatesSince('2026-03-07T07:10:00.000Z');

    expect(response.meta.newCount).toBe(6);
    expect(response.meta.newGlucoseCount).toBe(2);
    expect(response.meta.newTandemBasalCount).toBe(1);
    expect(response.meta.newTandemEventCount).toBe(1);
    expect(response.meta.newNoteMutationCount).toBe(2);
    expect(response.meta.timelineRevision).toBe('2026-03-07T07:20:00.000Z');
  });

  test('getUpdatesSince counts workout mutations and advances timeline revision from workout activity', async () => {
    vi.mocked(glucosePort.fetchLatest)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(glucosePort.fetchHistory).mockResolvedValue([]);
    vi.mocked(workoutPort.fetchWorkouts).mockResolvedValue([
      {
        id: 'workout-1',
        startAt: '2026-03-07T06:00:00.000Z',
        endAt: '2026-03-07T07:00:00.000Z',
        workoutType: 'run',
        rawWorkoutType: 'running',
        displayName: 'Morning run',
        sourceSystem: 'apple_health',
        sourceId: 'apple-workout-1',
        updatedAt: '2026-03-07T07:25:00.000Z'
      }
    ]);

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      workoutPort,
      notesPort,
      clock: () => new Date('2026-03-07T07:30:00.000Z')
    });

    const response = await service.getUpdatesSince('2026-03-07T07:10:00.000Z');

    expect(response.meta.newCount).toBe(1);
    expect(response.meta.newGlucoseCount).toBe(0);
    expect(response.meta.newWorkoutMutationCount).toBe(1);
    expect(response.meta.timelineRevision).toBe('2026-03-07T07:25:00.000Z');
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
      workoutPort,
      notesPort,
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
      workoutPort,
      notesPort,
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

  test('getHistory includes overlapping note items in the timeline snapshot', async () => {
    vi.mocked(glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(glucosePort.fetchHistory).mockResolvedValue([
      reading({
        id: 'official-1',
        timestamp: '2026-03-07T09:00:00.000Z',
        source: 'official'
      })
    ]);
    vi.mocked(notesPort.fetchNotes).mockResolvedValue([
      {
        id: 'note-1',
        text: 'Late lunch',
        startAt: '2026-03-07T11:00:00.000Z',
        endAt: '2026-03-07T13:00:00.000Z',
        timezone: 'Europe/Stockholm',
        allDay: false,
        authorType: 'user',
        source: 'dashboard',
        createdAt: '2026-03-07T13:05:00.000Z',
        updatedAt: '2026-03-07T13:05:00.000Z',
        createdBy: 'admin@pulseglucose.local',
        updatedBy: 'admin@pulseglucose.local'
      }
    ]);

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      workoutPort,
      notesPort,
      clock: () => new Date('2026-03-07T12:00:00.000Z')
    });

    const response = await service.getHistory({ range: '24h' });

    expect(response.noteItems).toHaveLength(1);
    expect(response.noteItems?.[0]?.id).toBe('note-1');
    expect(response.meta.timelineRevision).toBe('2026-03-07T13:05:00.000Z');
  });

  test('getHistory includes workout items in the timeline snapshot', async () => {
    vi.mocked(glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(glucosePort.fetchHistory).mockResolvedValue([
      reading({
        id: 'official-1',
        timestamp: '2026-03-07T09:00:00.000Z',
        source: 'official'
      })
    ]);
    vi.mocked(workoutPort.fetchWorkouts).mockResolvedValue([
      {
        id: 'workout-1',
        startAt: '2026-03-07T07:00:00.000Z',
        endAt: '2026-03-07T08:00:00.000Z',
        workoutType: 'run',
        rawWorkoutType: 'running',
        displayName: 'Morning run',
        sourceSystem: 'apple_health',
        sourceId: 'apple-workout-1',
        activeEnergyKilocalories: 483.4,
        distanceMeters: 5120.7
      }
    ]);

    const service = createDashboardGlucoseService({
      glucosePort,
      tandemPort,
      healthPort,
      workoutPort,
      notesPort,
      clock: () => new Date('2026-03-07T12:00:00.000Z')
    });

    const response = await service.getHistory({ range: '24h' });

    expect(workoutPort.fetchWorkouts).toHaveBeenCalledWith({
      from: '2026-03-06T12:00:00.000Z',
      to: '2026-03-07T12:00:00.000Z'
    });
    expect(response.workoutItems).toEqual([
      {
        id: 'workout-1',
        startAt: '2026-03-07T07:00:00.000Z',
        endAt: '2026-03-07T08:00:00.000Z',
        workoutType: 'run',
        rawWorkoutType: 'running',
        displayName: 'Morning run',
        sourceSystem: 'apple_health',
        sourceId: 'apple-workout-1',
        activeEnergyKilocalories: 483.4,
        distanceMeters: 5120.7
      }
    ]);
  });
});
