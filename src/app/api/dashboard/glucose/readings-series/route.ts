import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGlucoseHistory,
  fetchGlucoseReadingsSeries,
  mergeGlucoseReadings
} from '@/lib/veno-api/glucose';
import type { GlucoseReadingsSeriesResponse, MergedGlucosePoint } from '@/lib/veno-api/glucose';

export const dynamic = 'force-dynamic';

const FALLBACK_HISTORY_CHUNK_MS = 24 * 60 * 60 * 1000;
const FALLBACK_HISTORY_LIMIT = 1000;
const SERIES_POINTS_PER_BUCKET = 4;
const CORRECTION_EDIT_WINDOW_MS = 12 * 60 * 60 * 1000;

function parsePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function validatePositiveInteger(value: string | null, name: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || String(parsed) !== value.trim()) {
    return `${name} must be a positive integer.`;
  }

  return null;
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

async function loadFallbackHistorySeries(input: {
  from: string;
  to: string;
  maxDataPoints: number;
  intervalMs: number;
}): Promise<GlucoseReadingsSeriesResponse> {
  const fromMs = new Date(input.from).getTime();
  const toMs = new Date(input.to).getTime();
  const intervalMs = resolveFallbackIntervalMs({
    fromMs,
    toMs,
    maxDataPoints: input.maxDataPoints,
    intervalMs: input.intervalMs
  });
  const [official, share] = await Promise.all([
    fetchChunkedFallbackHistory('official', input.from, input.to),
    fetchChunkedFallbackHistory('share', input.from, input.to)
  ]);
  const merged = mergeGlucoseReadings(official, share);
  const mode = merged.length > input.maxDataPoints ? 'reduced' : 'raw';
  const selectedItems = mode === 'raw'
    ? merged
    : reduceFallbackSeriesByExcursions(merged, intervalMs).map((item) => {
      const { readingId, ...reducedItem } = item;
      return reducedItem;
    });
  const items = selectedItems.map((item) => {
    const point = {
      timestamp: item.timestamp,
      valueMmolL: item.valueMmolL,
      valueMgDl: item.valueMgDl,
      trend: item.trend,
      source: item.source,
      originalValueMmolL: item.originalValueMmolL ?? null,
      originalValueMgDl: item.originalValueMgDl ?? null,
      isCorrected: item.isCorrected ?? false,
      correctionReason: item.correctionReason ?? null
    };

    return 'readingId' in item && typeof item.readingId === 'string'
      ? { ...point, readingId: item.readingId }
      : point;
  });

  return {
    items,
    meta: {
      from: input.from,
      to: input.to,
      officialCount: official.length,
      shareCount: share.length,
      returned: items.length,
      source: resolveFallbackSource(official.length, share.length),
      resolution: {
        mode,
        intervalMs,
        maxDataPoints: input.maxDataPoints,
        returnedPoints: items.length
      },
      capabilities: {
        correctionsAllowed: mode === 'raw' && toMs - fromMs <= CORRECTION_EDIT_WINDOW_MS
      }
    }
  };
}

async function fetchChunkedFallbackHistory(
  source: 'official' | 'share',
  from: string,
  to: string
): Promise<Awaited<ReturnType<typeof fetchGlucoseHistory>>['items']> {
  const items: Awaited<ReturnType<typeof fetchGlucoseHistory>>['items'] = [];
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  for (let chunkStartMs = fromMs; chunkStartMs <= toMs; chunkStartMs += FALLBACK_HISTORY_CHUNK_MS + 1) {
    const chunkEndMs = Math.min(toMs, chunkStartMs + FALLBACK_HISTORY_CHUNK_MS);
    const response = await fetchGlucoseHistory(
      source,
      new Date(chunkStartMs).toISOString(),
      new Date(chunkEndMs).toISOString(),
      FALLBACK_HISTORY_LIMIT
    );
    items.push(...response.items);
  }

  return items;
}

function resolveFallbackIntervalMs(input: {
  fromMs: number;
  toMs: number;
  maxDataPoints: number;
  intervalMs: number;
}): number {
  if (input.intervalMs > 0) {
    return input.intervalMs;
  }

  const bucketBudget = Math.max(1, Math.floor(input.maxDataPoints / SERIES_POINTS_PER_BUCKET));
  return Math.max(1, Math.ceil((input.toMs - input.fromMs) / bucketBudget));
}

function resolveFallbackSource(
  officialCount: number,
  shareCount: number
): GlucoseReadingsSeriesResponse['meta']['source'] {
  if (officialCount > 0 && shareCount > 0) {
    return 'merged';
  }
  if (officialCount > 0) {
    return 'official';
  }
  if (shareCount > 0) {
    return 'share';
  }
  return 'none';
}

function reduceFallbackSeriesByExcursions(
  points: MergedGlucosePoint[],
  intervalMs: number
): MergedGlucosePoint[] {
  const buckets = new Map<number, MergedGlucosePoint[]>();

  for (const point of points) {
    const bucket = Math.floor(new Date(point.timestamp).getTime() / intervalMs) * intervalMs;
    const bucketPoints = buckets.get(bucket) ?? [];
    bucketPoints.push(point);
    buckets.set(bucket, bucketPoints);
  }

  const selected = new Map<string, MergedGlucosePoint>();
  const select = (point: MergedGlucosePoint) => {
    selected.set(new Date(point.timestamp).toISOString(), point);
  };

  for (const bucketPoints of buckets.values()) {
    const sorted = [...bucketPoints].sort(
      (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    let min = first;
    let max = first;

    for (const point of sorted) {
      if (point.valueMmolL < min.valueMmolL) {
        min = point;
      }
      if (point.valueMmolL > max.valueMmolL) {
        max = point;
      }
    }

    select(first);
    select(min);
    select(max);
    select(last);
  }

  return [...selected.values()].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const maxDataPoints = params.get('maxDataPoints');
  const intervalMs = params.get('intervalMs');
  const validationError =
    validatePositiveInteger(maxDataPoints, 'maxDataPoints')
    ?? validatePositiveInteger(intervalMs, 'intervalMs');

  if (validationError) {
    return NextResponse.json(
      { error: { message: validationError } },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  try {
    const response = await fetchGlucoseReadingsSeries({
      from: params.get('from'),
      to: params.get('to'),
      maxDataPoints: parsePositiveInteger(maxDataPoints),
      intervalMs: parsePositiveInteger(intervalMs)
    });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    const from = params.get('from');
    const to = params.get('to');
    const parsedMaxDataPoints = parsePositiveInteger(maxDataPoints) ?? 2000;
    const parsedIntervalMs = parsePositiveInteger(intervalMs) ?? 0;

    if (getErrorStatus(error) === 404 && from && to) {
      try {
        const response = await loadFallbackHistorySeries({
          from,
          to,
          maxDataPoints: parsedMaxDataPoints,
          intervalMs: parsedIntervalMs
        });

        return NextResponse.json(response, {
          headers: {
            'Cache-Control': 'no-store'
          }
        });
      } catch (fallbackError) {
        void fallbackError;
      }
    }

    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load glucose readings series' } },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
