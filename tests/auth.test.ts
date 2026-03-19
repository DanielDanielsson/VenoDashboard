import { describe, expect, test, vi } from 'vitest';

describe('owner session', () => {
  test('uses configured poc owner email and fixed cookie value', async () => {
    vi.stubEnv('AUTH_POC_EMAIL', 'daniel@example.com');

    const { ownerSessionCookieValue, getOwnerSession } = await import('@/lib/auth');

    expect(ownerSessionCookieValue()).toBe('poc-owner');
    expect(typeof getOwnerSession).toBe('function');
  });
});
