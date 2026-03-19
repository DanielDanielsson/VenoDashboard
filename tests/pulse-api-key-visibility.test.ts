import { describe, expect, test } from 'vitest';
import { isSystemApiKeyName } from '@/lib/pulse-api/key-visibility';

describe('system api key visibility', () => {
  test('detects system keys', () => {
    expect(isSystemApiKeyName('__internal:dashboard-admin-token')).toBe(true);
    expect(isSystemApiKeyName('dashboard-admin-token')).toBe(true);
    expect(isSystemApiKeyName('__internal:anything')).toBe(true);
  });

  test('keeps user keys visible', () => {
    expect(isSystemApiKeyName('ios-consumer-app')).toBe(false);
  });
});
