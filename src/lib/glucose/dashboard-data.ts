import {
  compressTandemBasalHistory,
  fetchGlucoseHistory,
  fetchGlucoseLatest,
  fetchTandemBasalHistory,
  fetchTandemEventHistory,
  pickLatestGlucoseReading,
  type TandemBasalHistoryPoint,
  type TandemEventHistoryPoint,
  type MergedGlucosePoint,
  mergeGlucoseReadings
} from '@/lib/pulse-api/glucose';
import type { PulseApiReading } from '@/lib/pulse-api/types';
import { getTimeRangeHours, type TimeRange } from './time-ranges';

const API_MAX_LIMIT = 1000;
const RESPONSE_MAX_LIMIT = 5000;
const CHUNK_MS = 2.5 * 24 * 60 * 60 * 1000;

export interface LatestDashboardReading extends PulseApiReading {
  source: 'official' | 'share';
}

export interface ResolvedHistoryWindow {
  from: string;
  to: string;
  range: TimeRange | null;
  hasExplicitRange: boolean;
}

export interface MergedWindowResult {
  officialItems: PulseApiReading[];
  shareItems: PulseApiReading[];
  tandemBasalItems: TandemBasalHistoryPoint[];
  tandemEventItems: TandemEventHistoryPoint[];
  merged: MergedGlucosePoint[];
}

export function parseLimit(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.min(parsed, RESPONSE_MAX_LIMIT);
}

export function resolveHistoryWindow(params: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
}): ResolvedHistoryWindow {
  const now = params.now ?? new Date();
  const rangeHours = getTimeRangeHours(params.range);

  if (rangeHours) {
    return {
      from: new Date(now.getTime() - rangeHours * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
      range: params.range as TimeRange,
      hasExplicitRange: true
    };
  }

  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  return {
    from: params.from || defaultFrom,
    to: params.to || now.toISOString(),
    range: null,
    hasExplicitRange: Boolean(params.from || params.to)
  };
}

async function fetchOfficialChunked(from: string, to: string): Promise<PulseApiReading[]> {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const rangeMs = toMs - fromMs;

  if (rangeMs <= CHUNK_MS) {
    const result = await fetchGlucoseHistory('official', from, to, API_MAX_LIMIT);
    return result.items;
  }

  const chunks: { from: string; to: string }[] = [];
  let cursor = fromMs;

  while (cursor < toMs) {
    const chunkEnd = Math.min(cursor + CHUNK_MS, toMs);
    chunks.push({
      from: new Date(cursor).toISOString(),
      to: new Date(chunkEnd).toISOString()
    });
    cursor = chunkEnd;
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      fetchGlucoseHistory('official', chunk.from, chunk.to, API_MAX_LIMIT)
        .then((result) => result.items)
        .catch(() => [] as PulseApiReading[])
    )
  );

  return results.flat();
}

export async function fetchLatestDashboardReading(): Promise<LatestDashboardReading | null> {
  const [latestOfficial, latestShare] = await Promise.all([
    fetchGlucoseLatest('official').catch(() => null),
    fetchGlucoseLatest('share').catch(() => null)
  ]);

  const latest = pickLatestGlucoseReading(latestOfficial, latestShare);
  if (!latest) {
    return null;
  }

  return {
    ...latest,
    source: latest === latestOfficial ? 'official' : 'share'
  };
}

export async function fetchMergedGlucoseWindow(
  from: string,
  to: string,
  now: Date = new Date()
): Promise<MergedWindowResult> {
  const shareWindowStart = new Date(
    Math.max(new Date(from).getTime(), now.getTime() - 4 * 60 * 60 * 1000)
  ).toISOString();

  const [officialItems, share] = await Promise.all([
    fetchOfficialChunked(from, to).catch(() => [] as PulseApiReading[]),
    fetchGlucoseHistory('share', shareWindowStart, to, 500).catch(() => ({ items: [] as PulseApiReading[] }))
  ]);
  const [tandemBasal, tandemEvents] = await Promise.all([
    fetchTandemBasalHistory(from, to, API_MAX_LIMIT).catch(() => ({
      items: [] as TandemBasalHistoryPoint[]
    })),
    fetchTandemEventHistory(from, to, API_MAX_LIMIT).catch(() => ({
      items: [] as TandemEventHistoryPoint[]
    }))
  ]);
  const tandemBasalItems = compressTandemBasalHistory(tandemBasal.items);

  return {
    officialItems,
    shareItems: share.items,
    tandemBasalItems,
    tandemEventItems: tandemEvents.items,
    merged: mergeGlucoseReadings(officialItems, share.items)
  };
}
