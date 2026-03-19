import { describe, expect, test } from 'vitest';
import { getGlucoseColor, getGlucoseHue } from '@/lib/glucose/tints';

describe('glucose tint utilities', () => {
  test('uses three color buckets in three color mode', () => {
    expect(getGlucoseColor(3.9, 'threeColors')).toBe('rgba(251, 113, 133, 1)');
    expect(getGlucoseColor(6.1, 'threeColors')).toBe('rgba(52, 211, 153, 1)');
    expect(getGlucoseColor(10.1, 'threeColors')).toBe('rgba(251, 191, 36, 1)');
  });

  test('anchors gradient hue at low target and high values', () => {
    expect(getGlucoseHue(4.0)).toBeCloseTo(0, 4);
    expect(getGlucoseHue(110 / 18)).toBeCloseTo(120, 4);
    expect(getGlucoseHue(10.0)).toBeCloseTo(270, 4);
  });
});
