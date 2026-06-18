import { describe, expect, test } from 'vitest';
import { isAllowedPath, isProtectedPath } from '@/../middleware';

describe('middleware path access', () => {
  test('allows public dashboards routes', () => {
    expect(isAllowedPath('/dashboards')).toBe(true);
    expect(isAllowedPath('/dashboards/overview')).toBe(true);
    expect(isAllowedPath('/dashboards/statistics')).toBe(true);
  });

  test('does not protect canonical dashboards routes', () => {
    expect(isProtectedPath('/dashboards')).toBe(false);
    expect(isProtectedPath('/dashboards/overview')).toBe(false);
    expect(isProtectedPath('/dashboards/statistics')).toBe(false);
  });

  test('protects owner dashboard routes', () => {
    expect(isProtectedPath('/dashboard')).toBe(false);
    expect(isProtectedPath('/dashboard/about')).toBe(false);
    expect(isProtectedPath('/dashboard/settings')).toBe(true);
    expect(isProtectedPath('/dashboard/api-keys')).toBe(true);
  });
});
