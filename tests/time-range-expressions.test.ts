import { describe, expect, test } from 'vitest';
import {
  resolveRawTimeRange,
  shiftTimeWindow,
  zoomOutTimeWindow,
} from '@/lib/glucose/time-range-expressions';

describe('time range expression helpers', () => {
  test('resolves relative now expressions', () => {
    const resolved = resolveRawTimeRange(
      { from: 'now-30m', to: 'now' },
      {
        now: new Date('2026-04-17T08:30:00.000Z'),
        timeZone: 'UTC',
        display: 'Last 30 minutes'
      }
    );

    expect(resolved?.window).toEqual({
      from: '2026-04-17T08:00:00.000Z',
      to: '2026-04-17T08:30:00.000Z'
    });
    expect(resolved?.display).toBe('Last 30 minutes');
    expect(resolved?.exceedsSafetyCap).toBe(false);
  });

  test('rounds day expressions differently for from and to', () => {
    const resolved = resolveRawTimeRange(
      { from: 'now-1d/d', to: 'now-1d/d' },
      {
        now: new Date('2026-04-17T08:30:00.000Z'),
        timeZone: 'UTC',
        display: 'Yesterday'
      }
    );

    expect(resolved?.window).toEqual({
      from: '2026-04-16T00:00:00.000Z',
      to: '2026-04-16T23:59:59.999Z'
    });
  });

  test('marks ranges above the dashboard cap', () => {
    const resolved = resolveRawTimeRange(
      { from: 'now-1y', to: 'now' },
      {
        now: new Date('2026-04-17T08:30:00.000Z'),
        timeZone: 'UTC',
        display: 'Last 1 year'
      }
    );

    expect(resolved?.exceedsSafetyCap).toBe(true);
  });

  test('shifts and zooms absolute windows', () => {
    const window = {
      from: '2026-04-17T08:00:00.000Z',
      to: '2026-04-17T09:00:00.000Z'
    };

    expect(shiftTimeWindow(window, -1)).toEqual({
      from: '2026-04-17T07:00:00.000Z',
      to: '2026-04-17T08:00:00.000Z'
    });
    expect(zoomOutTimeWindow(window)).toEqual({
      from: '2026-04-17T07:30:00.000Z',
      to: '2026-04-17T09:30:00.000Z'
    });
  });
});
