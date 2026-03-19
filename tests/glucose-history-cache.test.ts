import { describe, expect, test } from 'vitest';
import {
  buildPresetWindow,
  getHistoryCustomKey,
  getHistoryRangeKey,
  pickBestLoadedSourceKey,
  sliceHistoryResponseToWindow,
  type HistorySelection
} from '@/lib/glucose/history-cache';
import type { GlucoseApiResponse } from '@/lib/glucose/types';

function response(from: string, to: string): GlucoseApiResponse {
  return {
    items: [
      { timestamp: from, valueMmolL: 5.1, source: 'official' },
      { timestamp: '2026-03-06T12:00:00.000Z', valueMmolL: 5.4, source: 'share' },
      { timestamp: to, valueMmolL: 5.8, source: 'official' }
    ],
    basalItems: [
      {
        timestamp: '2026-03-06T08:00:00.000Z',
        basalRateUnitsPerHour: 0.7,
        eventName: 'BasalDelivery',
        localTimestamp: '2026-03-06T09:00:00',
        pumpTimeZone: 'Europe/Stockholm'
      },
      {
        timestamp: '2026-03-06T12:00:00.000Z',
        basalRateUnitsPerHour: 1.2,
        eventName: 'BasalDelivery',
        localTimestamp: '2026-03-06T13:00:00',
        pumpTimeZone: 'Europe/Stockholm'
      }
    ],
    eventItems: [
      {
        timestamp: '2026-03-06T07:30:00.000Z',
        eventName: 'BolusDelivery',
        localTimestamp: '2026-03-06T08:30:00',
        pumpTimeZone: 'Europe/Stockholm',
        insulinDelivered: 2.1,
        insulinRequested: null,
        iob: null,
        carbsGrams: null,
        glucoseMmolL: null
      },
      {
        timestamp: '2026-03-06T15:30:00.000Z',
        eventName: 'PumpingSuspended',
        localTimestamp: '2026-03-06T16:30:00',
        pumpTimeZone: 'Europe/Stockholm',
        insulinDelivered: null,
        insulinRequested: null,
        iob: null,
        carbsGrams: null,
        glucoseMmolL: null
      }
    ],
    latest: {
      timestamp: to,
      valueMmolL: 5.8,
      valueMgDl: 104,
      trend: 'flat',
      source: 'official'
    },
    meta: {
      from,
      to,
      officialCount: 2,
      shareCount: 1,
      mergedCount: 3,
      tandemBasalCount: 2,
      tandemEventCount: 2
    }
  };
}

describe('glucose history cache helpers', () => {
  test('prefers a loaded superset preset range for smaller preset selections', () => {
    const cache = new Map<string, { data?: GlucoseApiResponse }>([
      [getHistoryRangeKey('14d'), { data: response('2026-02-21T12:00:00.000Z', '2026-03-07T12:00:00.000Z') }],
      [getHistoryRangeKey('24h'), { data: response('2026-03-06T12:00:00.000Z', '2026-03-07T11:00:00.000Z') }]
    ]);

    const selection: HistorySelection = { kind: 'preset', range: '24h' };

    expect(pickBestLoadedSourceKey(cache, selection)).toBe(getHistoryRangeKey('14d'));
  });

  test('uses a loaded preset range to satisfy a custom range inside it', () => {
    const cache = new Map<string, { data?: GlucoseApiResponse }>([
      [getHistoryRangeKey('14d'), { data: response('2026-02-21T12:00:00.000Z', '2026-03-07T12:00:00.000Z') }]
    ]);

    const selection: HistorySelection = {
      kind: 'custom',
      window: {
        from: '2026-03-05T00:00:00.000Z',
        to: '2026-03-06T23:59:59.999Z'
      }
    };

    expect(pickBestLoadedSourceKey(cache, selection)).toBe(getHistoryRangeKey('14d'));
  });

  test('slices a response down to the requested target window', () => {
    const sliced = sliceHistoryResponseToWindow(
      response('2026-03-06T00:00:00.000Z', '2026-03-07T00:00:00.000Z'),
      {
        from: '2026-03-06T06:00:00.000Z',
        to: '2026-03-06T18:00:00.000Z'
      }
    );

    expect(sliced.items).toHaveLength(1);
    expect(sliced.items[0].timestamp).toBe('2026-03-06T12:00:00.000Z');
    expect(sliced.basalItems).toHaveLength(2);
    expect(sliced.basalItems[0].timestamp).toBe('2026-03-06T08:00:00.000Z');
    expect(sliced.basalItems[1].timestamp).toBe('2026-03-06T12:00:00.000Z');
    expect(sliced.eventItems).toHaveLength(2);
    expect(sliced.eventItems[0].timestamp).toBe('2026-03-06T07:30:00.000Z');
    expect(sliced.eventItems[1].timestamp).toBe('2026-03-06T15:30:00.000Z');
    expect(sliced.meta.officialCount).toBe(0);
    expect(sliced.meta.shareCount).toBe(1);
    expect(sliced.meta.tandemBasalCount).toBe(2);
    expect(sliced.meta.tandemEventCount).toBe(2);
  });

  test('keeps the last basal step before the requested window', () => {
    const base = response('2026-03-06T00:00:00.000Z', '2026-03-07T00:00:00.000Z');
    const sliced = sliceHistoryResponseToWindow(
      {
        ...base,
        basalItems: [
          {
            timestamp: '2026-03-06T04:00:00.000Z',
            basalRateUnitsPerHour: 0.6,
            eventName: 'BasalDelivery',
            localTimestamp: '2026-03-06T05:00:00',
            pumpTimeZone: 'Europe/Stockholm'
          },
          ...base.basalItems
        ]
      },
      {
        from: '2026-03-06T06:00:00.000Z',
        to: '2026-03-06T18:00:00.000Z'
      }
    );

    expect(sliced.basalItems).toHaveLength(3);
    expect(sliced.basalItems[0].timestamp).toBe('2026-03-06T04:00:00.000Z');
    expect(sliced.meta.tandemBasalCount).toBe(3);
    expect(sliced.meta.tandemEventCount).toBe(2);
  });

  test('buildPresetWindow uses the requested preset duration ending at the provided timestamp', () => {
    expect(buildPresetWindow('2026-03-07T12:00:00.000Z', '24h')).toEqual({
      from: '2026-03-06T12:00:00.000Z',
      to: '2026-03-07T12:00:00.000Z'
    });
  });

  test('builds a stable custom history key', () => {
    expect(
      getHistoryCustomKey({
        from: '2026-03-05T00:00:00.000Z',
        to: '2026-03-06T23:59:59.999Z'
      })
    ).toContain('from=2026-03-05T00%3A00%3A00.000Z');
  });
});
