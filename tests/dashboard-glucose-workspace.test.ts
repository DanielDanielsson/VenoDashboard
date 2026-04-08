import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createDashboardGlucoseWorkspace,
  type DashboardGlucoseWorkspaceDeps
} from '@/lib/glucose/dashboard-workspace';
import type { GlucoseCorrectionBatchPayload, PulseApiReading } from '@/lib/pulse-api/types';

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

describe('dashboard glucose workspace', () => {
  let deps: DashboardGlucoseWorkspaceDeps;
  let currentTime: Date;

  beforeEach(() => {
    currentTime = new Date('2026-03-04T00:00:00.000Z');
    deps = {
      glucosePort: {
        fetchLatest: vi.fn().mockResolvedValue(null),
        fetchHistory: vi.fn().mockResolvedValue([])
      },
      tandemPort: {
        fetchBasal: vi.fn().mockResolvedValue([]),
        fetchEvents: vi.fn().mockResolvedValue([])
      },
      healthPort: {
        fetchSteps: vi.fn().mockResolvedValue([])
      },
      correctionsPort: {
        apply: vi.fn().mockResolvedValue({
          updated: 0,
          cleared: 0
        })
      },
      clock: () => currentTime
    };
  });

  test('opens a preset range and returns a merged glucose snapshot', async () => {
    vi.mocked(deps.glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(deps.glucosePort.fetchHistory).mockImplementation(async (source, window) => {
      if (source === 'official') {
        return [
          reading({
            id: `official-${window.from}`,
            timestamp: window.from,
            valueMmolL: 5.1,
            valueMgDl: 92,
            source: 'official'
          })
        ];
      }

      return [
        reading({
          id: `share-${window.to}`,
          timestamp: new Date(new Date(window.to).getTime() - 5 * 60 * 1000).toISOString(),
          valueMmolL: 5.9,
          valueMgDl: 106,
          source: 'share'
        })
      ];
    });

    const workspace = createDashboardGlucoseWorkspace(deps);

    const session = await workspace.open({ range: '3d' });

    expect(session.snapshot.meta.from).toBe('2026-03-01T00:00:00.000Z');
    expect(session.snapshot.meta.to).toBe('2026-03-04T00:00:00.000Z');
    expect(session.snapshot.meta.officialCount).toBe(2);
    expect(session.snapshot.meta.shareCount).toBe(2);
    expect(session.snapshot.items).toHaveLength(4);
    expect(session.snapshot.items.map((item) => item.source)).toEqual([
      'official',
      'share',
      'official',
      'share'
    ]);
  });

  test('refreshes an open session without reloading when no new data exists', async () => {
    vi.mocked(deps.glucosePort.fetchLatest)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(deps.glucosePort.fetchHistory).mockImplementation(async (source, window) => {
      if (source === 'official') {
        return [
          reading({
            id: 'official-1',
            timestamp: window.to,
            valueMmolL: 5.8,
            valueMgDl: 104,
            source: 'official'
          })
        ];
      }

      return [];
    });

    const workspace = createDashboardGlucoseWorkspace(deps);

    const session = await workspace.open({ range: '3d' });
    const historyCallsAfterOpen = vi.mocked(deps.glucosePort.fetchHistory).mock.calls.length;
    const refreshed = await session.refresh();

    expect(refreshed.snapshot).toEqual(session.snapshot);
    expect(deps.glucosePort.fetchHistory).toHaveBeenCalledTimes(historyCallsAfterOpen);
  });

  test('refreshes an open session by reloading the preset window when new data exists', async () => {
    let officialCallCount = 0;

    vi.mocked(deps.glucosePort.fetchLatest)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        reading({
          id: 'official-latest',
          timestamp: '2026-03-04T00:05:00.000Z',
          valueMmolL: 6.4,
          valueMgDl: 115,
          source: 'official'
        })
      )
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        reading({
          id: 'official-latest',
          timestamp: '2026-03-04T00:05:00.000Z',
          valueMmolL: 6.4,
          valueMgDl: 115,
          source: 'official'
        })
      )
      .mockResolvedValueOnce(null);
    vi.mocked(deps.glucosePort.fetchHistory).mockImplementation(async (source, window) => {
      if (source === 'official') {
        officialCallCount += 1;
        const isReload = officialCallCount > 2;

        return [
          reading({
            id: isReload ? 'official-2' : 'official-1',
            timestamp: isReload ? '2026-03-04T00:05:00.000Z' : window.to,
            valueMmolL: isReload ? 6.4 : 5.8,
            valueMgDl: isReload ? 115 : 104,
            source: 'official'
          })
        ];
      }

      return [];
    });

    const workspace = createDashboardGlucoseWorkspace(deps);

    const session = await workspace.open({ range: '3d' });
    currentTime = new Date('2026-03-04T00:05:00.000Z');

    const refreshed = await session.refresh();

    expect(refreshed.snapshot.latest?.id).toBe('official-latest');
    expect(refreshed.snapshot.items.at(-1)?.readingId).toBe('official-2');
  });

  test('applies corrections through the workspace and returns a refreshed session', async () => {
    let correctionApplied = false;
    const payload: GlucoseCorrectionBatchPayload = {
      items: [
        {
          source: 'official',
          readingId: 'official-1',
          valueMmolL: 5.2,
          reason: 'Compression low'
        }
      ]
    };

    vi.mocked(deps.glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(deps.glucosePort.fetchHistory).mockImplementation(async (source, window) => {
      if (source === 'official') {
        return [
          reading({
            id: 'official-1',
            timestamp: window.to,
            valueMmolL: correctionApplied ? 5.2 : 5.8,
            valueMgDl: correctionApplied ? 94 : 104,
            originalValueMmolL: correctionApplied ? 5.8 : null,
            originalValueMgDl: correctionApplied ? 104 : null,
            isCorrected: correctionApplied,
            correctionReason: correctionApplied ? 'Compression low' : null,
            source: 'official'
          })
        ];
      }

      return [];
    });
    vi.mocked(deps.correctionsPort.apply).mockImplementation(async (input) => {
      expect(input).toEqual(payload);
      correctionApplied = true;

      return {
        updated: 1,
        cleared: 0
      };
    });

    const workspace = createDashboardGlucoseWorkspace(deps);

    const session = await workspace.open({ range: '3d' });
    const refreshed = await session.applyCorrections(payload);

    expect(deps.correctionsPort.apply).toHaveBeenCalledWith(payload);
    expect(refreshed.snapshot.items[0]).toEqual(
      expect.objectContaining({
        readingId: 'official-1',
        valueMmolL: 5.2,
        originalValueMmolL: 5.8,
        isCorrected: true,
        correctionReason: 'Compression low'
      })
    );
  });

  test('clears corrections through the workspace and returns the restored session', async () => {
    let correctionCleared = false;
    const payload: GlucoseCorrectionBatchPayload = {
      items: [
        {
          source: 'official',
          readingId: 'official-1',
          valueMmolL: null,
          reason: null
        }
      ]
    };

    vi.mocked(deps.glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(deps.glucosePort.fetchHistory).mockImplementation(async (source, window) => {
      if (source === 'official') {
        return [
          reading({
            id: 'official-1',
            timestamp: window.to,
            valueMmolL: correctionCleared ? 5.8 : 5.2,
            valueMgDl: correctionCleared ? 104 : 94,
            originalValueMmolL: correctionCleared ? null : 5.8,
            originalValueMgDl: correctionCleared ? null : 104,
            isCorrected: !correctionCleared,
            correctionReason: correctionCleared ? null : 'Compression low',
            source: 'official'
          })
        ];
      }

      return [];
    });
    vi.mocked(deps.correctionsPort.apply).mockImplementation(async (input) => {
      expect(input).toEqual(payload);
      correctionCleared = true;

      return {
        updated: 0,
        cleared: 1
      };
    });

    const workspace = createDashboardGlucoseWorkspace(deps);

    const session = await workspace.open({ range: '3d' });
    const refreshed = await session.applyCorrections(payload);

    expect(deps.correctionsPort.apply).toHaveBeenCalledWith(payload);
    expect(refreshed.snapshot.items[0]).toEqual(
      expect.objectContaining({
        readingId: 'official-1',
        valueMmolL: 5.8,
        originalValueMmolL: null,
        isCorrected: false,
        correctionReason: null
      })
    );
  });

  test('opens an explicit custom window and preserves chunked history fetch behavior', async () => {
    vi.mocked(deps.glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(deps.glucosePort.fetchHistory).mockImplementation(async (source, window) => [
      reading({
        id: `${source}-${window.from}`,
        timestamp: window.from,
        source
      })
    ]);

    const workspace = createDashboardGlucoseWorkspace(deps);

    const session = await workspace.open({
      window: {
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-06T00:00:00.000Z'
      }
    });

    expect(session.snapshot.meta.from).toBe('2026-03-01T00:00:00.000Z');
    expect(session.snapshot.meta.to).toBe('2026-03-06T00:00:00.000Z');
    expect(deps.glucosePort.fetchHistory).toHaveBeenCalledTimes(4);
  });

  test('opens a custom window even when tandem and step enrichment fail', async () => {
    vi.mocked(deps.glucosePort.fetchLatest).mockResolvedValue(null);
    vi.mocked(deps.glucosePort.fetchHistory).mockImplementation(async (source, window) => [
      reading({
        id: `${source}-${window.to}`,
        timestamp:
          source === 'official'
            ? new Date(new Date(window.to).getTime() - 5 * 60 * 1000).toISOString()
            : window.to,
        source
      })
    ]);
    vi.mocked(deps.tandemPort.fetchBasal).mockRejectedValue(new Error('tandem down'));
    vi.mocked(deps.tandemPort.fetchEvents).mockRejectedValue(new Error('tandem down'));
    vi.mocked(deps.healthPort.fetchSteps).mockRejectedValue(new Error('health down'));

    const workspace = createDashboardGlucoseWorkspace(deps);

    const session = await workspace.open({
      window: {
        from: '2026-03-04T00:00:00.000Z',
        to: '2026-03-04T06:00:00.000Z'
      }
    });

    expect(session.snapshot.items).toHaveLength(2);
    expect(session.snapshot.basalItems).toEqual([]);
    expect(session.snapshot.eventItems).toEqual([]);
    expect(session.snapshot.stepItems).toEqual([]);
  });
});
