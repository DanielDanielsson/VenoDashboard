import { describe, expect, test } from 'vitest';
import {
  AGP_BUCKETS_PER_DAY,
  computeAgpProfile,
  filterAgpItemsByWeekday,
  getAgpWeekdayCounts
} from '@/lib/glucose/agp';
import type { ChartPoint } from '@/lib/glucose/types';

function point(timestamp: string, valueMmolL: number): ChartPoint {
  return {
    timestamp,
    valueMmolL,
    source: 'official'
  };
}

describe('computeAgpProfile', () => {
  test('groups readings into 5 minute floor buckets and computes percentiles', () => {
    const profile = computeAgpProfile([
      point('2026-03-01T10:02:00', 5),
      point('2026-03-02T10:04:00', 7),
      point('2026-03-03T10:04:59', 9),
      point('2026-03-04T10:03:30', 11),
      point('2026-03-04T10:05:00', 13)
    ]);

    const firstBucket = profile.buckets[120];
    const secondBucket = profile.buckets[121];

    expect(profile.dayCount).toBe(4);
    expect(profile.buckets).toHaveLength(AGP_BUCKETS_PER_DAY);
    expect(firstBucket.sampleCount).toBe(4);
    expect(firstBucket.p05).toBeCloseTo(5.3, 6);
    expect(firstBucket.p25).toBeCloseTo(6.5, 6);
    expect(firstBucket.p50).toBeCloseTo(8, 6);
    expect(firstBucket.p75).toBeCloseTo(9.5, 6);
    expect(firstBucket.p95).toBeCloseTo(10.7, 6);
    expect(secondBucket.sampleCount).toBe(1);
    expect(secondBucket.p50).toBe(13);
  });

  test('returns empty buckets when no readings exist', () => {
    const profile = computeAgpProfile([]);

    expect(profile.dayCount).toBe(0);
    expect(profile.buckets).toHaveLength(AGP_BUCKETS_PER_DAY);
    expect(profile.buckets.every((bucket) => bucket.sampleCount === 0 && bucket.p50 === null)).toBe(true);
  });

  test('counts unique weekdays and filters AGP data to a single weekday', () => {
    const items = [
      point('2026-03-07T10:00:00', 5.2),
      point('2026-03-07T14:00:00', 6.1),
      point('2026-03-08T11:00:00', 7.4),
      point('2026-03-14T10:00:00', 8.3)
    ];

    const counts = getAgpWeekdayCounts(items);
    const saturdayItems = filterAgpItemsByWeekday(items, 'saturday');
    const saturdayProfile = computeAgpProfile(saturdayItems);

    expect(counts.all).toBe(3);
    expect(counts.saturday).toBe(2);
    expect(counts.sunday).toBe(1);
    expect(saturdayItems).toHaveLength(3);
    expect(saturdayProfile.dayCount).toBe(2);
  });
});
