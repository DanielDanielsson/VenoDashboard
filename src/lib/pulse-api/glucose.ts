import type { PulseApiReading } from '@/lib/pulse-api/types';
import { getApiBaseUrl } from '@/lib/pulse-api/env';
import { fetchWithApiAuth } from '@/lib/pulse-api/auth-fetch';

export interface GlucoseHistoryResponse {
  items: PulseApiReading[];
  meta: {
    from: string;
    to: string;
    limit: number;
    returned: number;
  };
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
  timestamp: string;
  valueMmolL: number;
  valueMgDl: number;
  trend: string;
  source: 'official' | 'share';
}

function getReadingMinuteKey(timestamp: string): number {
  return Math.floor(new Date(timestamp).getTime() / 60_000);
}

function isUnavailableReading(reading: PulseApiReading | null): boolean {
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

export async function fetchGlucoseLatest(
  source: 'official' | 'share'
): Promise<PulseApiReading | null> {
  const basePath =
    source === 'official' ? '/api/v1/glucose/latest' : '/api/v1/share/glucose/latest';

  const response = await fetchWithApiAuth(resolveUrl(basePath), { cache: 'no-store' });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<PulseApiReading>;
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

export function pickLatestGlucoseReading(
  official: PulseApiReading | null,
  share: PulseApiReading | null
): PulseApiReading | null {
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
  official: PulseApiReading[],
  share: PulseApiReading[]
): MergedGlucosePoint[] {
  const pointMap = new Map<number, MergedGlucosePoint>();

  for (const reading of official) {
    const key = getReadingMinuteKey(reading.timestamp);
    pointMap.set(key, {
      timestamp: reading.timestamp,
      valueMmolL: reading.valueMmolL,
      valueMgDl: reading.valueMgDl,
      trend: reading.trend,
      source: 'official'
    });
  }

  for (const reading of share) {
    const key = getReadingMinuteKey(reading.timestamp);
    if (!pointMap.has(key)) {
      pointMap.set(key, {
        timestamp: reading.timestamp,
        valueMmolL: reading.valueMmolL,
        valueMgDl: reading.valueMgDl,
        trend: reading.trend,
        source: 'share'
      });
    }
  }

  return Array.from(pointMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
