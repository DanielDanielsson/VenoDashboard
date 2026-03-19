import { GLUCOSE_TIME_RANGES, getTimeRangeHours, type TimeRange } from './time-ranges';
import type { GlucoseApiResponse } from './types';

export interface HistoryWindow {
  from: string;
  to: string;
}

export type HistorySelection =
  | { kind: 'preset'; range: TimeRange }
  | { kind: 'custom'; window: HistoryWindow };

interface HistoryCacheEntry {
  data?: GlucoseApiResponse;
}

export interface HistoryCacheLike {
  get(key: string): HistoryCacheEntry | undefined;
}

function toMs(value: string): number {
  return new Date(value).getTime();
}

export function getHistoryRangeKey(range: TimeRange): string {
  return `/api/dashboard/glucose/history?range=${range}`;
}

export function getHistoryCustomKey(window: HistoryWindow): string {
  return `/api/dashboard/glucose/history?from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}`;
}

export function buildPresetWindow(endIso: string, range: TimeRange): HistoryWindow {
  const hours = getTimeRangeHours(range) ?? 24;
  const endMs = toMs(endIso);

  return {
    from: new Date(endMs - hours * 60 * 60 * 1000).toISOString(),
    to: new Date(endMs).toISOString()
  };
}

export function getResponseFreshness(response: GlucoseApiResponse): number {
  return toMs(response.latest?.timestamp ?? response.meta.to);
}

function windowContains(source: HistoryWindow, target: HistoryWindow): boolean {
  return toMs(source.from) <= toMs(target.from) && toMs(source.to) >= toMs(target.to);
}

function getCachedData(cache: HistoryCacheLike, key: string): GlucoseApiResponse | undefined {
  return cache.get(key)?.data;
}

function pickBasalItemsForWindow(
  basalItems: GlucoseApiResponse['basalItems'],
  window: HistoryWindow
): GlucoseApiResponse['basalItems'] {
  const toMsValue = toMs(window.to);
  const candidates = basalItems.filter((item) => toMs(item.timestamp) <= toMsValue);
  if (candidates.length === 0) {
    return [];
  }

  const fromMs = toMs(window.from);
  let startIndex = 0;

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (toMs(candidates[index].timestamp) <= fromMs) {
      startIndex = index;
      break;
    }

    startIndex = index;
  }

  return candidates.slice(startIndex);
}

function pickEventItemsForWindow(
  eventItems: GlucoseApiResponse['eventItems'],
  window: HistoryWindow
): GlucoseApiResponse['eventItems'] {
  const fromMs = toMs(window.from);
  const toMsValue = toMs(window.to);

  return eventItems.filter((item) => {
    const timestampMs = toMs(item.timestamp);
    return timestampMs >= fromMs && timestampMs <= toMsValue;
  });
}

export function pickBestLoadedSourceKey(
  cache: HistoryCacheLike,
  selection: HistorySelection
): string | null {
  if (selection.kind === 'preset') {
    const targetHours = getTimeRangeHours(selection.range);
    if (!targetHours) {
      return null;
    }

    let bestMatch: { key: string; hours: number; freshness: number } | null = null;

    for (const timeRange of GLUCOSE_TIME_RANGES) {
      if (timeRange.hours < targetHours) {
        continue;
      }

      const data = getCachedData(cache, getHistoryRangeKey(timeRange.key));
      if (!data) {
        continue;
      }

      const candidate = {
        key: getHistoryRangeKey(timeRange.key),
        hours: timeRange.hours,
        freshness: getResponseFreshness(data)
      };

      if (
        !bestMatch ||
        candidate.freshness > bestMatch.freshness ||
        (candidate.freshness === bestMatch.freshness && candidate.hours > bestMatch.hours)
      ) {
        bestMatch = candidate;
      }
    }

    return bestMatch?.key ?? null;
  }

  const exactCustomKey = getHistoryCustomKey(selection.window);
  const candidates = [
    exactCustomKey,
    ...GLUCOSE_TIME_RANGES.map((timeRange) => getHistoryRangeKey(timeRange.key))
  ];

  let bestMatch: { key: string; freshness: number; spanMs: number } | null = null;

  for (const key of candidates) {
    const data = getCachedData(cache, key);
    if (!data) {
      continue;
    }

    if (!windowContains(data.meta, selection.window)) {
      continue;
    }

    const candidate = {
      key,
      freshness: getResponseFreshness(data),
      spanMs: toMs(data.meta.to) - toMs(data.meta.from)
    };

    if (
      !bestMatch ||
      candidate.freshness > bestMatch.freshness ||
      (candidate.freshness === bestMatch.freshness && candidate.spanMs < bestMatch.spanMs)
    ) {
      bestMatch = candidate;
    }
  }

  return bestMatch?.key ?? null;
}

export function sliceHistoryResponseToWindow(
  sourceData: GlucoseApiResponse,
  window: HistoryWindow
): GlucoseApiResponse {
  const fromMs = toMs(window.from);
  const toMsValue = toMs(window.to);
  const items = sourceData.items.filter((item) => {
    const timestampMs = toMs(item.timestamp);
    return timestampMs >= fromMs && timestampMs <= toMsValue;
  });
  const officialCount = items.filter((item) => item.source === 'official').length;
  const shareCount = items.length - officialCount;
  const basalItems = pickBasalItemsForWindow(sourceData.basalItems, window);
  const eventItems = pickEventItemsForWindow(sourceData.eventItems, window);

  return {
    ...sourceData,
    items,
    basalItems,
    eventItems,
    meta: {
      from: window.from,
      to: window.to,
      officialCount,
      shareCount,
      mergedCount: items.length,
      tandemBasalCount: basalItems.length,
      tandemEventCount: eventItems.length
    }
  };
}
