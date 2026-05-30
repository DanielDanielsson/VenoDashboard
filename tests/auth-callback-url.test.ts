import { describe, expect, test } from 'vitest';
import {
  PUBLIC_DASHBOARD_FALLBACK_URL,
  getLoginCloseUrl,
  normalizeAuthCallbackUrl,
} from '@/lib/auth-callback-url';

describe('auth callback urls', () => {
  test('keeps protected local callback urls for successful sign in', () => {
    expect(normalizeAuthCallbackUrl('/dashboard/settings?tab=profile')).toBe('/dashboard/settings?tab=profile');
  });

  test('rejects login callbacks to avoid returning to the sign in overlay', () => {
    expect(normalizeAuthCallbackUrl('/login?callbackUrl=/dashboard/settings')).toBe('/dashboard');
  });

  test('rejects protocol relative callback urls', () => {
    expect(normalizeAuthCallbackUrl('//evil.example/dashboard')).toBe('/dashboard');
  });

  test('rejects malformed callback urls', () => {
    expect(normalizeAuthCallbackUrl('/dashboard/%zz')).toBe('/dashboard');
  });

  test('uses a public dashboard destination when closing from protected pages', () => {
    expect(getLoginCloseUrl('/dashboard/settings')).toBe(PUBLIC_DASHBOARD_FALLBACK_URL);
    expect(getLoginCloseUrl('/api/dashboard/preferences')).toBe(PUBLIC_DASHBOARD_FALLBACK_URL);
  });

  test('keeps public dashboard destinations when closing the overlay', () => {
    expect(getLoginCloseUrl('/dashboards/training?range=3d')).toBe('/dashboards/training?range=3d');
    expect(getLoginCloseUrl('/dashboard/statistics?range=3d')).toBe(PUBLIC_DASHBOARD_FALLBACK_URL);
  });
});
