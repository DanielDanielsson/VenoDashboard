import { beforeEach, describe, expect, test, vi } from 'vitest';

const fetchGlucoseHistory = vi.fn();
const fetchGlucoseLatest = vi.fn();
const fetchTandemBasalHistory = vi.fn();
const fetchTandemEventHistory = vi.fn();
const fetchHealthStepHistory = vi.fn();
const compressTandemBasalHistory = vi.fn((items) => items);
const pickLatestGlucoseReading = vi.fn();
const mergeGlucoseReadings = vi.fn((official, share) => [...official, ...share]);

vi.mock('@/lib/pulse-api/glucose', () => ({
  fetchGlucoseHistory,
  fetchGlucoseLatest,
  fetchTandemBasalHistory,
  fetchTandemEventHistory,
  fetchHealthStepHistory,
  compressTandemBasalHistory,
  pickLatestGlucoseReading,
  mergeGlucoseReadings
}));

describe('dashboard data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchGlucoseLatest.mockResolvedValue(null);
    fetchTandemBasalHistory.mockResolvedValue({ items: [] });
    fetchTandemEventHistory.mockResolvedValue({ items: [] });
    fetchHealthStepHistory.mockResolvedValue({ items: [] });
  });

  test('fetchMergedGlucoseWindow requests share history across the full requested range', async () => {
    fetchGlucoseHistory
      .mockResolvedValueOnce({
        items: [{ timestamp: '2026-03-15T00:00:00.000Z', valueMmolL: 5.5, valueMgDl: 99, trend: 'flat' }]
      })
      .mockResolvedValueOnce({
        items: [{ timestamp: '2026-03-15T00:05:00.000Z', valueMmolL: 5.6, valueMgDl: 101, trend: 'flat' }]
      });

    const { fetchMergedGlucoseWindow } = await import('@/lib/glucose/dashboard-data');

    await fetchMergedGlucoseWindow(
      '2026-03-15T00:00:00.000Z',
      '2026-03-15T06:00:00.000Z',
      new Date('2026-03-20T00:00:00.000Z')
    );

    expect(fetchGlucoseHistory).toHaveBeenNthCalledWith(
      1,
      'official',
      '2026-03-15T00:00:00.000Z',
      '2026-03-15T06:00:00.000Z',
      1000
    );
    expect(fetchGlucoseHistory).toHaveBeenNthCalledWith(
      2,
      'share',
      '2026-03-15T00:00:00.000Z',
      '2026-03-15T06:00:00.000Z',
      1000
    );
  });
});
