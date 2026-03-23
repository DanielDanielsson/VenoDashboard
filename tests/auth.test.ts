import { describe, expect, test, vi } from 'vitest';

describe('owner session', () => {
  test('derives cookie value as SHA-256 hash of password', async () => {
    vi.stubEnv('OWNER_LOGIN_USERNAME', 'daniel');
    vi.stubEnv('OWNER_LOGIN_PASSWORD', 'venoplatform');

    const {
      ownerSessionCookieValue,
      getOwnerSession,
      hasOwnerCredentialsConfigured,
      validateOwnerCredentials
    } = await import('@/lib/auth');

    const cookieValue = await ownerSessionCookieValue();
    expect(cookieValue).toMatch(/^owner-session:[a-f0-9]{64}$/);
    expect(cookieValue).not.toContain('venoplatform');
    expect(hasOwnerCredentialsConfigured()).toBe(true);
    expect(validateOwnerCredentials('daniel', 'venoplatform')).toBe(true);
    expect(validateOwnerCredentials('daniel', 'wrong')).toBe(false);
    expect(typeof getOwnerSession).toBe('function');
  });

  test('returns same hash for same password', async () => {
    vi.stubEnv('OWNER_LOGIN_PASSWORD', 'venoplatform');

    const { ownerSessionCookieValue } = await import('@/lib/auth');

    const first = await ownerSessionCookieValue();
    const second = await ownerSessionCookieValue();
    expect(first).toBe(second);
  });

  test('returns empty string when password not configured', async () => {
    vi.stubEnv('OWNER_LOGIN_PASSWORD', '');

    const { ownerSessionCookieValue } = await import('@/lib/auth');

    expect(await ownerSessionCookieValue()).toBe('');
  });
});
