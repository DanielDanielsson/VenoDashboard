export type TimeRange = '6h' | '12h' | '24h' | '3d' | '7d' | '14d';

export const GLUCOSE_TIME_RANGES: { key: TimeRange; label: string; hours: number }[] = [
  { key: '6h', label: '6h', hours: 6 },
  { key: '12h', label: '12h', hours: 12 },
  { key: '24h', label: '24h', hours: 24 },
  { key: '3d', label: '3 days', hours: 72 },
  { key: '7d', label: '7 days', hours: 168 },
  { key: '14d', label: '2 weeks', hours: 336 }
];

export function getTimeRangeHours(range: string | null | undefined): number | null {
  if (!range) {
    return null;
  }

  return GLUCOSE_TIME_RANGES.find((item) => item.key === range)?.hours ?? null;
}
