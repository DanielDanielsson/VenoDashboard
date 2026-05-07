import { describe, expect, test } from 'vitest';
import { getGlucoseColor, getGlucoseHue } from '@/lib/glucose/tints';
import { convertGlucoseValue } from '@/lib/glucose/units';

describe('glucose tint utilities', () => {
  test('uses standard color buckets in standard mode', () => {
    expect(getGlucoseColor(3.9, 'standard')).toBe('rgba(251, 113, 133, 1)');
    expect(getGlucoseColor(6.1, 'standard')).toBe('rgba(52, 211, 153, 1)');
    expect(getGlucoseColor(10.1, 'standard')).toBe('rgba(168, 85, 247, 1)');
  });

  test('anchors gradient hue at low target and high values', () => {
    expect(getGlucoseHue(4.0)).toBeCloseTo(0, 4);
    expect(getGlucoseHue(convertGlucoseValue(110, 'mg/dL', 'mmol/L'))).toBeCloseTo(120, 4);
    expect(getGlucoseHue(10.0)).toBeCloseTo(270, 4);
  });
});
