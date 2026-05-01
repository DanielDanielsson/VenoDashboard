import { describe, expect, test } from 'vitest';
import { isAllowedPath } from '@/../middleware';

describe('middleware path access', () => {
  test('allows public dashboards routes', () => {
    expect(isAllowedPath('/dashboards')).toBe(true);
    expect(isAllowedPath('/dashboards/overview')).toBe(true);
    expect(isAllowedPath('/dashboards/statistics')).toBe(true);
  });
});
