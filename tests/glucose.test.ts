import { describe, expect, test } from 'vitest';
import { convertGlucoseValue } from '@/lib/glucose/units';
import { mergeGlucoseReadings, pickLatestGlucoseReading } from '@/lib/pulse-api/glucose';
import type { PulseApiReading } from '@/lib/pulse-api/types';

function reading(
  timestamp: string,
  valueMmolL: number,
  source: 'official' | 'share'
): PulseApiReading {
  return {
    timestamp,
    valueMmolL,
    valueMgDl: Math.round(convertGlucoseValue(valueMmolL, 'mmol/L', 'mg/dL')),
    trend: source === 'official' ? 'flat' : 'up',
    source
  };
}

describe('glucose helpers', () => {
  test('mergeGlucoseReadings prefers official readings in the same minute and sorts the timeline', () => {
    const merged = mergeGlucoseReadings(
      [
        reading('2026-03-07T10:05:10.000Z', 5.8, 'official'),
        reading('2026-03-07T10:15:00.000Z', 6.1, 'official')
      ],
      [
        reading('2026-03-07T10:05:40.000Z', 6.7, 'share'),
        reading('2026-03-07T10:10:00.000Z', 5.9, 'share')
      ]
    );

    expect(merged).toEqual([
      expect.objectContaining({
        timestamp: '2026-03-07T10:05:10.000Z',
        valueMmolL: 5.8,
        source: 'official'
      }),
      expect.objectContaining({
        timestamp: '2026-03-07T10:10:00.000Z',
        valueMmolL: 5.9,
        source: 'share'
      }),
      expect.objectContaining({
        timestamp: '2026-03-07T10:15:00.000Z',
        valueMmolL: 6.1,
        source: 'official'
      })
    ]);
  });

  test('mergeGlucoseReadings preserves correction metadata in both units', () => {
    const merged = mergeGlucoseReadings(
      [
        {
          ...reading('2026-03-07T10:05:10.000Z', 5.8, 'official'),
          originalValueMmolL: 6.4,
          originalValueMgDl: 115,
          isCorrected: true,
          correctionReason: 'Compression low'
        }
      ],
      []
    );

    expect(merged).toEqual([
      expect.objectContaining({
        timestamp: '2026-03-07T10:05:10.000Z',
        valueMmolL: 5.8,
        valueMgDl: 105,
        originalValueMmolL: 6.4,
        originalValueMgDl: 115,
        isCorrected: true,
        correctionReason: 'Compression low',
        source: 'official'
      })
    ]);
  });

  test('pickLatestGlucoseReading returns the freshest reading and prefers official on the same minute', () => {
    const official = reading('2026-03-07T10:20:10.000Z', 6.1, 'official');
    const shareFresher = reading('2026-03-07T10:25:00.000Z', 6.4, 'share');
    const shareSameMinute = reading('2026-03-07T10:20:40.000Z', 6.3, 'share');

    expect(pickLatestGlucoseReading(official, shareFresher)).toBe(shareFresher);
    expect(pickLatestGlucoseReading(official, shareSameMinute)).toBe(official);
    expect(pickLatestGlucoseReading(null, shareFresher)).toBe(shareFresher);
    expect(pickLatestGlucoseReading(official, null)).toBe(official);
  });

  test('pickLatestGlucoseReading prefers available share reading over unavailable official placeholder', () => {
    const officialUnavailable: PulseApiReading = {
      timestamp: '2026-03-07T10:30:00.000Z',
      valueMmolL: 0,
      valueMgDl: 0,
      trend: 'unknown',
      status: 'unavailable'
    };
    const shareAvailable = reading('2026-03-07T10:25:00.000Z', 6.4, 'share');

    expect(pickLatestGlucoseReading(officialUnavailable, shareAvailable)).toBe(shareAvailable);
  });
});
