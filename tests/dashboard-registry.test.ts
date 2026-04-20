import { describe, expect, test } from 'vitest';
import { getDashboardDefinition } from '@/lib/dashboard/registry';

describe('dashboard registry', () => {
  test('returns the built in overview dashboard definition', () => {
    const dashboard = getDashboardDefinition('overview');

    expect(dashboard.spec.uid).toBe('overview');
    expect(dashboard.spec.title).toBe('Overview');
    expect(Object.keys(dashboard.spec.elements)).toEqual([
      'panel-current-glucose',
      'panel-timers',
      'panel-time-in-range',
      'panel-connections',
    ]);
    expect(dashboard.spec.layout.spec.items.find((item) => item.spec.element.name === 'panel-connections')?.spec.y).toBe(8);
  });

  test('returns the built in statistics dashboard definition', () => {
    const dashboard = getDashboardDefinition('statistics');

    expect(dashboard.spec.uid).toBe('statistics');
    expect(dashboard.spec.title).toBe('Statistics');
    expect(Object.keys(dashboard.spec.elements)).toEqual([
      'panel-average-glucose',
      'panel-time-in-range',
      'panel-glucose-timeline',
      'panel-agp',
    ]);
    expect(dashboard.spec.layout.spec.items.map((item) => item.spec.element.name)).toEqual([
      'panel-average-glucose',
      'panel-time-in-range',
      'panel-glucose-timeline',
      'panel-agp',
    ]);
  });
});
