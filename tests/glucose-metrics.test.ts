import { describe, expect, test } from 'vitest';
import { computeGlucoseStats } from '@/lib/glucose/metrics';
import type { ChartPoint } from '@/lib/glucose/types';

function point(valueMmolL: number): ChartPoint {
  return {
    timestamp: '2026-03-07T10:00:00.000Z',
    valueMmolL,
    source: 'official'
  };
}

describe('computeGlucoseStats', () => {
  test('splits values into standard glucose ranges', () => {
    const stats = computeGlucoseStats([
      point(2.8),
      point(3.7),
      point(5.6),
      point(8.9),
      point(11.2),
      point(15.4)
    ]);

    expect(stats.avg).toBeCloseTo(7.933333, 6);
    expect(stats.min).toBe(2.8);
    expect(stats.max).toBe(15.4);
    expect(stats.veryLow).toEqual({ count: 1, percentage: 17 });
    expect(stats.low).toEqual({ count: 1, percentage: 17 });
    expect(stats.inRange).toEqual({ count: 2, percentage: 33 });
    expect(stats.high).toEqual({ count: 1, percentage: 17 });
    expect(stats.veryHigh).toEqual({ count: 1, percentage: 17 });
  });
});
