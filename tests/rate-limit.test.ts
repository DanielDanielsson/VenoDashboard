import { beforeEach, expect, test, vi } from 'vitest';
import { applyRateLimit } from '@/lib/security/rate-limit';

beforeEach(() => {
  vi.useRealTimers();
});

test('blocks requests after the configured limit inside one window', () => {
  const key = `test-limit-${Date.now()}`;

  expect(applyRateLimit({ key, limit: 2, windowMs: 1_000 }).allowed).toBe(true);
  expect(applyRateLimit({ key, limit: 2, windowMs: 1_000 }).allowed).toBe(true);
  expect(applyRateLimit({ key, limit: 2, windowMs: 1_000 }).allowed).toBe(false);
});

test('allows requests again after the rate limit window expires', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-21T12:00:00Z'));

  const key = 'window-reset';

  expect(applyRateLimit({ key, limit: 1, windowMs: 1_000 }).allowed).toBe(true);
  expect(applyRateLimit({ key, limit: 1, windowMs: 1_000 }).allowed).toBe(false);

  vi.advanceTimersByTime(1_001);

  expect(applyRateLimit({ key, limit: 1, windowMs: 1_000 }).allowed).toBe(true);
});
