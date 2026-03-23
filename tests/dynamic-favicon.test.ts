import { describe, expect, test } from 'vitest';
import { isDynamicFaviconReadingStale } from '../ui/components/DynamicFavicon/DynamicFavicon';

describe('DynamicFavicon staleness', () => {
  test('keeps favicon colored for readings up to 6 minutes old', () => {
    const nowMs = Date.parse('2026-03-22T12:06:00.000Z');
    const timestamp = '2026-03-22T12:00:00.000Z';

    expect(isDynamicFaviconReadingStale(timestamp, nowMs)).toBe(false);
  });

  test('turns favicon white when reading is older than 6 minutes', () => {
    const nowMs = Date.parse('2026-03-22T12:06:00.001Z');
    const timestamp = '2026-03-22T12:00:00.000Z';

    expect(isDynamicFaviconReadingStale(timestamp, nowMs)).toBe(true);
  });

  test('treats invalid timestamps as stale', () => {
    expect(isDynamicFaviconReadingStale('not-a-date', Date.now())).toBe(true);
  });
});
