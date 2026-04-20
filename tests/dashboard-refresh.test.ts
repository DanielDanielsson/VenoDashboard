import { describe, expect, test } from 'vitest';
import {
  DASHBOARD_REFRESH_AUTO,
  DASHBOARD_REFRESH_OFF,
  parseRefreshIntervalMs,
  resolveRefreshIntervalMs,
} from '@/lib/dashboard/refresh';

describe('dashboard refresh helpers', () => {
  test('parses supported refresh intervals', () => {
    expect(parseRefreshIntervalMs('5s')).toBe(5_000);
    expect(parseRefreshIntervalMs('10m')).toBe(600_000);
    expect(parseRefreshIntervalMs('1h')).toBe(3_600_000);
  });

  test('rejects invalid refresh intervals', () => {
    expect(parseRefreshIntervalMs('')).toBeNull();
    expect(parseRefreshIntervalMs('0s')).toBeNull();
    expect(parseRefreshIntervalMs('15d')).toBeNull();
    expect(parseRefreshIntervalMs('soon')).toBeNull();
  });

  test('treats an empty refresh setting as off', () => {
    expect(resolveRefreshIntervalMs(DASHBOARD_REFRESH_OFF, null, 1440)).toBeNull();
  });

  test('calculates an automatic interval from range and viewport width', () => {
    expect(
      resolveRefreshIntervalMs(
        DASHBOARD_REFRESH_AUTO,
        {
          from: '2026-04-19T09:00:00.000Z',
          to: '2026-04-19T12:00:00.000Z',
        },
        1080,
      ),
    ).toBe(10_000);
  });

  test('clamps automatic refresh intervals', () => {
    expect(
      resolveRefreshIntervalMs(
        DASHBOARD_REFRESH_AUTO,
        {
          from: '2026-04-19T11:59:00.000Z',
          to: '2026-04-19T12:00:00.000Z',
        },
        1440,
      ),
    ).toBe(5_000);

    expect(
      resolveRefreshIntervalMs(
        DASHBOARD_REFRESH_AUTO,
        {
          from: '2026-04-12T12:00:00.000Z',
          to: '2026-04-19T12:00:00.000Z',
        },
        320,
      ),
    ).toBe(60_000);
  });
});
