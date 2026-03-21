import { describe, expect, test, vi } from 'vitest';

describe('owner session', () => {
  test('derives owner session cookie value from configured login credentials', async () => {
    vi.stubEnv('AUTH_POC_EMAIL', 'daniel@example.com');
    vi.stubEnv('OWNER_LOGIN_USERNAME', 'daniel');
    vi.stubEnv('OWNER_LOGIN_PASSWORD', 'venoplatform');

    const {
      ownerSessionCookieValue,
      getOwnerSession,
      hasOwnerCredentialsConfigured,
      validateOwnerCredentials
    } = await import('@/lib/auth');

    expect(ownerSessionCookieValue()).toBe('owner-session:daniel');
    expect(hasOwnerCredentialsConfigured()).toBe(true);
    expect(validateOwnerCredentials('daniel', 'venoplatform')).toBe(true);
    expect(validateOwnerCredentials('daniel', 'wrong')).toBe(false);
    expect(typeof getOwnerSession).toBe('function');
  });
});
