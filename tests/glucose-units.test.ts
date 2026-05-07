import { describe, expect, test } from 'vitest';
import {
  convertGlucoseValue,
  formatGlucoseDeltaValue,
  formatGlucoseValue,
} from '@/lib/glucose/units';

describe('glucose unit utilities', () => {
  test('converts between mmol/L and mg/dL using the glucose molar mass factor', () => {
    expect(convertGlucoseValue(5.5, 'mmol/L', 'mg/dL')).toBeCloseTo(99.1001, 4);
    expect(convertGlucoseValue(99.1001, 'mg/dL', 'mmol/L')).toBeCloseTo(5.5, 4);
  });

  test('formats absolute glucose values for dashboard display', () => {
    expect(formatGlucoseValue(6.84, 'mmol/L')).toBe('6.8');
    expect(formatGlucoseValue(6.84, 'mg/dL')).toBe('123');
  });

  test('formats glucose deltas with correct precision and signs', () => {
    expect(formatGlucoseDeltaValue(0.14, 'mmol/L')).toBe('+0.1');
    expect(formatGlucoseDeltaValue(-0.14, 'mmol/L')).toBe('-0.1');
    expect(formatGlucoseDeltaValue(0.14, 'mg/dL')).toBe('+3');
    expect(formatGlucoseDeltaValue(-0.02, 'mg/dL')).toBe('0');
  });
});
