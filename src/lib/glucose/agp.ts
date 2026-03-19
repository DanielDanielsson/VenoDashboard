import type { ChartPoint } from './types';

export const AGP_BUCKET_MINUTES = 5;
export const AGP_BUCKETS_PER_DAY = (24 * 60) / AGP_BUCKET_MINUTES;
export const AGP_WEEKDAY_OPTIONS = [
  { key: 'all', label: 'All days', shortLabel: 'All', day: null },
  { key: 'monday', label: 'Mondays', shortLabel: 'Mon', day: 1 },
  { key: 'tuesday', label: 'Tuesdays', shortLabel: 'Tue', day: 2 },
  { key: 'wednesday', label: 'Wednesdays', shortLabel: 'Wed', day: 3 },
  { key: 'thursday', label: 'Thursdays', shortLabel: 'Thu', day: 4 },
  { key: 'friday', label: 'Fridays', shortLabel: 'Fri', day: 5 },
  { key: 'saturday', label: 'Saturdays', shortLabel: 'Sat', day: 6 },
  { key: 'sunday', label: 'Sundays', shortLabel: 'Sun', day: 0 }
] as const;

export type AgpWeekdayFilter = (typeof AGP_WEEKDAY_OPTIONS)[number]['key'];

export interface AgpBucketStats {
  bucketIndex: number;
  minuteOfDay: number;
  sampleCount: number;
  p05: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
}

export interface AgpProfile {
  buckets: AgpBucketStats[];
  dayCount: number;
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function getBucketIndex(timestamp: string): number {
  const date = new Date(timestamp);
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  return Math.floor(totalMinutes / AGP_BUCKET_MINUTES) % AGP_BUCKETS_PER_DAY;
}

function getDayKey(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getFilterDay(filter: AgpWeekdayFilter): number | null {
  return AGP_WEEKDAY_OPTIONS.find((option) => option.key === filter)?.day ?? null;
}

export function filterAgpItemsByWeekday(items: ChartPoint[], filter: AgpWeekdayFilter): ChartPoint[] {
  const targetDay = getFilterDay(filter);
  if (targetDay === null) {
    return items;
  }

  return items.filter((item) => new Date(item.timestamp).getDay() === targetDay);
}

export function getAgpWeekdayCounts(items: ChartPoint[]): Record<AgpWeekdayFilter, number> {
  const daySets = new Map<AgpWeekdayFilter, Set<string>>(
    AGP_WEEKDAY_OPTIONS.map((option) => [option.key, new Set<string>()])
  );

  for (const item of items) {
    const dayKey = getDayKey(item.timestamp);
    daySets.get('all')?.add(dayKey);

    const weekday = new Date(item.timestamp).getDay();
    const option = AGP_WEEKDAY_OPTIONS.find((entry) => entry.day === weekday);
    if (option) {
      daySets.get(option.key)?.add(dayKey);
    }
  }

  return Object.fromEntries(
    AGP_WEEKDAY_OPTIONS.map((option) => [option.key, daySets.get(option.key)?.size ?? 0])
  ) as Record<AgpWeekdayFilter, number>;
}

export function computeAgpProfile(items: ChartPoint[]): AgpProfile {
  const buckets = Array.from({ length: AGP_BUCKETS_PER_DAY }, () => [] as number[]);
  const dayKeys = new Set<string>();

  for (const item of items) {
    dayKeys.add(getDayKey(item.timestamp));
    buckets[getBucketIndex(item.timestamp)].push(item.valueMmolL);
  }

  return {
    dayCount: dayKeys.size,
    buckets: buckets.map((values, bucketIndex) => ({
      bucketIndex,
      minuteOfDay: bucketIndex * AGP_BUCKET_MINUTES,
      sampleCount: values.length,
      p05: percentile(values, 0.05),
      p10: percentile(values, 0.1),
      p25: percentile(values, 0.25),
      p50: percentile(values, 0.5),
      p75: percentile(values, 0.75),
      p90: percentile(values, 0.9),
      p95: percentile(values, 0.95)
    }))
  };
}
