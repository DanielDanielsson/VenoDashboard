import { describe, expect, test } from 'vitest';
import { formatWorkoutMetrics } from '@/lib/glucose/workout-display';

describe('workout display helpers', () => {
  test('formats available workout metrics', () => {
    expect(formatWorkoutMetrics({
      activeEnergyKilocalories: 483.4,
      distanceMeters: 5120.7
    })).toEqual(['483 kcal', '5.1 km']);
  });

  test('omits missing workout metrics', () => {
    expect(formatWorkoutMetrics({
      activeEnergyKilocalories: null,
      distanceMeters: undefined
    })).toEqual([]);
  });
});
