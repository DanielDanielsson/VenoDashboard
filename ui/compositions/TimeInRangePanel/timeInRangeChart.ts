import type { PieChartSlice } from '@ui/components/PieChart';
import type { GlucoseStats } from '@/lib/glucose/metrics';

const TIME_IN_RANGE_SEGMENTS = [
  {
    id: 'very-low',
    label: 'Very Low',
    color: 'var(--color-base-glucose-low-dark)',
    getValue: (stats: GlucoseStats) => stats.veryLow.percentage,
  },
  {
    id: 'low',
    label: 'Low',
    color: 'var(--color-base-error-dark)',
    getValue: (stats: GlucoseStats) => stats.low.percentage,
  },
  {
    id: 'in-range',
    label: 'In Range',
    color: 'var(--color-base-accent-bright)',
    getValue: (stats: GlucoseStats) => stats.inRange.percentage,
  },
  {
    id: 'high',
    label: 'High',
    color: 'var(--color-base-glucose-high-dark)',
    getValue: (stats: GlucoseStats) => stats.high.percentage,
  },
  {
    id: 'very-high',
    label: 'Very High',
    color: 'var(--color-base-glucose-very-high-dark)',
    getValue: (stats: GlucoseStats) => stats.veryHigh.percentage,
  },
] as const;

export function buildTimeInRangePieSlices(stats: GlucoseStats | null): PieChartSlice[] {
  return TIME_IN_RANGE_SEGMENTS.map((segment) => ({
    id: segment.id,
    label: segment.label,
    value: stats ? segment.getValue(stats) : 0,
    color: segment.color,
  }));
}
