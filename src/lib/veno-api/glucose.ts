import type {
  GlucoseCorrectionBatchPayload,
  GlucoseCorrectionBatchResponse,
  VenoApiReading
} from '@/lib/veno-api/types';
import { getAdminApiToken, getApiBaseUrl } from '@/lib/veno-api/env';
import { fetchWithApiAuth } from '@/lib/veno-api/auth-fetch';
import { VenoApiClientError } from '@/lib/veno-api/client';

export interface GlucoseHistoryResponse {
  items: VenoApiReading[];
  meta: {
    from: string;
    to: string;
    limit: number;
    returned: number;
  };
}

export interface GlucoseReadingsSeriesPoint {
  readingId?: string;
  timestamp: string;
  valueMmolL: number;
  valueMgDl: number;
  originalValueMmolL?: number | null;
  originalValueMgDl?: number | null;
  isCorrected?: boolean;
  correctionReason?: string | null;
  trend: string;
  source: 'official' | 'share';
}

export interface GlucoseReadingsSeriesResponse {
  items: GlucoseReadingsSeriesPoint[];
  meta: {
    from: string;
    to: string;
    officialCount: number;
    shareCount: number;
    returned: number;
    source: 'official' | 'share' | 'merged' | 'none';
    resolution: {
      mode: 'raw' | 'reduced';
      intervalMs: number;
      maxDataPoints: number;
      returnedPoints: number;
    };
    capabilities: {
      correctionsAllowed: boolean;
    };
  };
}

export interface GlucoseReadingsSeriesRequest {
  from: string | null;
  to: string | null;
  maxDataPoints: number | null;
  intervalMs: number | null;
}

export interface TandemBasalHistoryPoint {
  timestamp: string;
  basalRateUnitsPerHour: number;
  eventName: string;
  localTimestamp: string;
  pumpTimeZone: string;
}

export interface TandemBasalHistoryResponse {
  items: TandemBasalHistoryPoint[];
  meta: {
    from: string;
    to: string;
    limit: number;
    returned: number;
  };
}

export interface TandemEventHistoryPoint {
  timestamp: string;
  eventName: string;
  localTimestamp: string;
  pumpTimeZone: string;
  insulinDelivered: number | null;
  insulinRequested: number | null;
  iob: number | null;
  carbsGrams: number | null;
  glucoseMmolL: number | null;
}

export interface TandemEventHistoryResponse {
  items: TandemEventHistoryPoint[];
  meta: {
    from: string;
    to: string;
    limit: number;
    returned: number;
  };
}

export interface HealthStepHistoryPoint {
  bucketStart: string;
  bucketEnd: string;
  stepCount: number;
  source: string;
}

export interface HealthStepHistoryResponse {
  items: HealthStepHistoryPoint[];
}

export interface WorkoutHistoryPoint {
  id: string;
  startAt: string;
  endAt: string;
  workoutType: string;
  rawWorkoutType: string | null;
  displayName: string | null;
  sourceSystem: string;
  sourceId: string | null;
  activeEnergyKilocalories?: number | null;
  distanceMeters?: number | null;
  updatedAt?: string;
}

export interface WorkoutHistoryResponse {
  items: WorkoutHistoryPoint[];
}

const BASAL_VISUAL_STEP = 0.1;

function roundBasalRate(value: number): number {
  return Number((Math.round(value / BASAL_VISUAL_STEP) * BASAL_VISUAL_STEP).toFixed(1));
}

export function compressTandemBasalHistory(
  items: TandemBasalHistoryPoint[]
): TandemBasalHistoryPoint[] {
  if (items.length <= 1) {
    return items;
  }

  const sorted = [...items].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const compressed: TandemBasalHistoryPoint[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const point = sorted[index];
    const previous = compressed[compressed.length - 1];
    const roundedRate = roundBasalRate(point.basalRateUnitsPerHour);
    const previousRoundedRate = roundBasalRate(previous.basalRateUnitsPerHour);

    if (roundedRate === previousRoundedRate) {
      continue;
    }

    compressed.push({
      ...point,
      basalRateUnitsPerHour: roundedRate
    });
  }

  return compressed.map((point, index) =>
    index === 0
      ? {
          ...point,
          basalRateUnitsPerHour: roundBasalRate(point.basalRateUnitsPerHour)
        }
      : point
  );
}

export interface MergedGlucosePoint {
  readingId?: string;
  timestamp: string;
  valueMmolL: number;
  valueMgDl: number;
  trend: string;
  source: 'official' | 'share';
  originalValueMmolL?: number | null;
  originalValueMgDl?: number | null;
  isCorrected?: boolean;
  correctionReason?: string | null;
}

function getReadingMinuteKey(timestamp: string): number {
  return Math.floor(new Date(timestamp).getTime() / 60_000);
}

function isUnavailableReading(reading: VenoApiReading | null): boolean {
  if (!reading) {
    return true;
  }

  if (reading.status === 'unavailable') {
    return true;
  }

  return (
    reading.valueMmolL === 0 &&
    reading.valueMgDl === 0 &&
    reading.trend === 'unknown'
  );
}

function resolveUrl(path: string): string {
  return new URL(path, getApiBaseUrl()).toString();
}

export async function fetchGlucoseHistory(
  source: 'official' | 'share',
  from: string,
  to: string,
  limit = 2000
): Promise<GlucoseHistoryResponse> {
  const basePath =
    source === 'official' ? '/api/v1/glucose/history' : '/api/v1/share/glucose/history';

  const url = new URL(resolveUrl(basePath));
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  url.searchParams.set('limit', String(limit));

  const response = await fetchWithApiAuth(url.toString(), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Glucose history (${source}) failed with status ${response.status}`);
  }

  return response.json() as Promise<GlucoseHistoryResponse>;
}

export async function fetchGlucoseReadingsSeries(
  request: GlucoseReadingsSeriesRequest
): Promise<GlucoseReadingsSeriesResponse> {
  const url = new URL(resolveUrl('/api/v1/glucose/readings-series'));
  if (request.from) {
    url.searchParams.set('from', request.from);
  }
  if (request.to) {
    url.searchParams.set('to', request.to);
  }
  if (request.maxDataPoints != null) {
    url.searchParams.set('maxDataPoints', String(request.maxDataPoints));
  }
  if (request.intervalMs != null) {
    url.searchParams.set('intervalMs', String(request.intervalMs));
  }

  const response = await fetchWithApiAuth(url.toString(), { cache: 'no-store' });

  if (!response.ok) {
    throw new VenoApiClientError(response.status, `Glucose readings series failed with status ${response.status}`);
  }

  return response.json() as Promise<GlucoseReadingsSeriesResponse>;
}

export async function fetchGlucoseLatest(
  source: 'official' | 'share'
): Promise<VenoApiReading | null> {
  const basePath =
    source === 'official' ? '/api/v1/glucose/latest' : '/api/v1/share/glucose/latest';

  const response = await fetchWithApiAuth(resolveUrl(basePath), { cache: 'no-store' });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<VenoApiReading>;
}

export async function fetchTandemBasalHistory(
  from: string,
  to: string,
  limit = 2000
): Promise<TandemBasalHistoryResponse> {
  const url = new URL(resolveUrl('/api/v1/tandem/basal/history'));
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  url.searchParams.set('limit', String(limit));

  const response = await fetchWithApiAuth(url.toString(), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Tandem basal history failed with status ${response.status}`);
  }

  return response.json() as Promise<TandemBasalHistoryResponse>;
}

export async function fetchTandemEventHistory(
  from: string,
  to: string,
  limit = 2000
): Promise<TandemEventHistoryResponse> {
  const url = new URL(resolveUrl('/api/v1/tandem/events/history'));
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  url.searchParams.set('limit', String(limit));

  const response = await fetchWithApiAuth(url.toString(), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Tandem event history failed with status ${response.status}`);
  }

  return response.json() as Promise<TandemEventHistoryResponse>;
}

export async function fetchHealthStepHistory(
  from: string,
  to: string
): Promise<HealthStepHistoryResponse> {
  const url = new URL(resolveUrl('/api/admin/health/steps'));
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getAdminApiToken()}`
    }
  });

  if (!response.ok) {
    throw new Error(`Health step history failed with status ${response.status}`);
  }

  return response.json() as Promise<HealthStepHistoryResponse>;
}

export async function fetchWorkoutHistory(
  from: string,
  to: string
): Promise<WorkoutHistoryResponse> {
  const url = new URL(resolveUrl('/api/admin/health/workouts'));
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getAdminApiToken()}`
    }
  });

  if (!response.ok) {
    throw new Error(`Workout history failed with status ${response.status}`);
  }

  return response.json() as Promise<WorkoutHistoryResponse>;
}

export function pickLatestGlucoseReading(
  official: VenoApiReading | null,
  share: VenoApiReading | null
): VenoApiReading | null {
  const officialUnavailable = isUnavailableReading(official);
  const shareUnavailable = isUnavailableReading(share);

  if (officialUnavailable && !shareUnavailable) {
    return share;
  }

  if (shareUnavailable && !officialUnavailable) {
    return official;
  }

  if (!official) return share;
  if (!share) return official;

  const officialKey = getReadingMinuteKey(official.timestamp);
  const shareKey = getReadingMinuteKey(share.timestamp);

  if (officialKey === shareKey) {
    return official;
  }

  return officialKey > shareKey ? official : share;
}

/**
 * Merges official and share glucose readings into a single timeline.
 * Official readings are preferred. Share readings fill in the recent gap
 * where official data hasn't arrived yet (~3h delay).
 */
export function mergeGlucoseReadings(
  official: VenoApiReading[],
  share: VenoApiReading[]
): MergedGlucosePoint[] {
  const pointMap = new Map<number, MergedGlucosePoint>();

  for (const reading of official) {
    const key = getReadingMinuteKey(reading.timestamp);
    pointMap.set(key, {
      timestamp: reading.timestamp,
      readingId: reading.id,
      valueMmolL: reading.valueMmolL,
      valueMgDl: reading.valueMgDl,
      trend: reading.trend,
      source: 'official',
      originalValueMmolL: reading.originalValueMmolL ?? null,
      originalValueMgDl: reading.originalValueMgDl ?? null,
      isCorrected: reading.isCorrected ?? false,
      correctionReason: reading.correctionReason ?? null
    });
  }

  for (const reading of share) {
    const key = getReadingMinuteKey(reading.timestamp);
    if (!pointMap.has(key)) {
      pointMap.set(key, {
        timestamp: reading.timestamp,
        readingId: reading.id,
        valueMmolL: reading.valueMmolL,
        valueMgDl: reading.valueMgDl,
        trend: reading.trend,
        source: 'share',
        originalValueMmolL: reading.originalValueMmolL ?? null,
        originalValueMgDl: reading.originalValueMgDl ?? null,
        isCorrected: reading.isCorrected ?? false,
        correctionReason: reading.correctionReason ?? null
      });
    }
  }

  return Array.from(pointMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export async function updateGlucoseCorrections(
  payload: GlucoseCorrectionBatchPayload
): Promise<GlucoseCorrectionBatchResponse> {
  const response = await fetch(resolveUrl('/api/admin/glucose/corrections'), {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getAdminApiToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Glucose correction update failed with status ${response.status}`);
  }

  return response.json() as Promise<GlucoseCorrectionBatchResponse>;
}
