import {
  compressTandemBasalHistory,
  fetchHealthStepHistory,
  fetchGlucoseHistory,
  fetchGlucoseLatest,
  fetchTandemBasalHistory,
  fetchTandemEventHistory,
  pickLatestGlucoseReading,
  type HealthStepHistoryPoint,
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
const TANDEM_CHUNK_MS = 24 * 60 * 60 * 1000;

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
  healthStepItems: HealthStepHistoryPoint[];
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

async function fetchChunkedHistory(
  source: 'official' | 'share',
  from: string,
  to: string
): Promise<PulseApiReading[]> {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const rangeMs = toMs - fromMs;

  if (rangeMs <= CHUNK_MS) {
    const result = await fetchGlucoseHistory(source, from, to, API_MAX_LIMIT);
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
      fetchGlucoseHistory(source, chunk.from, chunk.to, API_MAX_LIMIT)
        .then((result) => result.items)
        .catch(() => [] as PulseApiReading[])
    )
  );

  return results.flat();
}

async function fetchChunkedTandemBasalHistory(
  from: string,
  to: string
): Promise<TandemBasalHistoryPoint[]> {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const rangeMs = toMs - fromMs;

  if (rangeMs <= TANDEM_CHUNK_MS) {
    const result = await fetchTandemBasalHistory(from, to, API_MAX_LIMIT);
    return result.items;
  }

  const chunks: { from: string; to: string }[] = [];
  let cursor = fromMs;

  while (cursor < toMs) {
    const chunkEnd = Math.min(cursor + TANDEM_CHUNK_MS, toMs);
    chunks.push({
      from: new Date(cursor).toISOString(),
      to: new Date(chunkEnd).toISOString()
    });
    cursor = chunkEnd;
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      fetchTandemBasalHistory(chunk.from, chunk.to, API_MAX_LIMIT)
        .then((result) => result.items)
        .catch(() => [] as TandemBasalHistoryPoint[])
    )
  );

  return results.flat();
}

async function fetchChunkedTandemEventHistory(
  from: string,
  to: string
): Promise<TandemEventHistoryPoint[]> {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const rangeMs = toMs - fromMs;

  if (rangeMs <= TANDEM_CHUNK_MS) {
    const result = await fetchTandemEventHistory(from, to, API_MAX_LIMIT);
    return result.items;
  }

  const chunks: { from: string; to: string }[] = [];
  let cursor = fromMs;

  while (cursor < toMs) {
    const chunkEnd = Math.min(cursor + TANDEM_CHUNK_MS, toMs);
    chunks.push({
      from: new Date(cursor).toISOString(),
      to: new Date(chunkEnd).toISOString()
    });
    cursor = chunkEnd;
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      fetchTandemEventHistory(chunk.from, chunk.to, API_MAX_LIMIT)
        .then((result) => result.items)
        .catch(() => [] as TandemEventHistoryPoint[])
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
  _now: Date = new Date()
): Promise<MergedWindowResult> {
  void _now;

  const [officialItems, share] = await Promise.all([
    fetchChunkedHistory('official', from, to).catch(() => [] as PulseApiReading[]),
    fetchChunkedHistory('share', from, to).catch(() => [] as PulseApiReading[])
  ]);
  const [tandemBasal, tandemEvents, healthSteps] = await Promise.all([
    fetchChunkedTandemBasalHistory(from, to).catch(() => [] as TandemBasalHistoryPoint[]),
    fetchChunkedTandemEventHistory(from, to).catch(() => [] as TandemEventHistoryPoint[]),
    fetchHealthStepHistory(from, to).catch(() => ({
      items: [] as HealthStepHistoryPoint[]
    }))
  ]);
  const tandemBasalItems = compressTandemBasalHistory(tandemBasal);

  return {
    officialItems,
    shareItems: share,
    tandemBasalItems,
    tandemEventItems: tandemEvents,
    healthStepItems: healthSteps.items,
    merged: mergeGlucoseReadings(officialItems, share)
  };
}
