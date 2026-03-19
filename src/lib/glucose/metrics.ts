import type { ChartPoint } from './types';

export interface GlucoseRangeBreakdown {
  count: number;
  percentage: number;
}

export interface GlucoseStats {
  avg: number;
  min: number;
  max: number;
  inRange: GlucoseRangeBreakdown;
  low: GlucoseRangeBreakdown;
  veryLow: GlucoseRangeBreakdown;
  high: GlucoseRangeBreakdown;
  veryHigh: GlucoseRangeBreakdown;
}

function toPercentage(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export function computeGlucoseStats(items: ChartPoint[]): GlucoseStats {
  if (items.length === 0) {
    return {
      avg: 0,
      min: 0,
      max: 0,
      inRange: { count: 0, percentage: 0 },
      low: { count: 0, percentage: 0 },
      veryLow: { count: 0, percentage: 0 },
      high: { count: 0, percentage: 0 },
      veryHigh: { count: 0, percentage: 0 }
    };
  }

  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let inRange = 0;
  let low = 0;
  let veryLow = 0;
  let high = 0;
  let veryHigh = 0;

  for (const point of items) {
    const value = point.valueMmolL;
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;

    if (value < 3.0) {
      veryLow += 1;
    } else if (value < 4.0) {
      low += 1;
    } else if (value <= 10.0) {
      inRange += 1;
    } else if (value < 14.0) {
      high += 1;
    } else {
      veryHigh += 1;
    }
  }

  return {
    avg: sum / items.length,
    min,
    max,
    inRange: { count: inRange, percentage: toPercentage(inRange, items.length) },
    low: { count: low, percentage: toPercentage(low, items.length) },
    veryLow: { count: veryLow, percentage: toPercentage(veryLow, items.length) },
    high: { count: high, percentage: toPercentage(high, items.length) },
    veryHigh: { count: veryHigh, percentage: toPercentage(veryHigh, items.length) }
  };
}
