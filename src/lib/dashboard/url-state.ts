import { resolveRawTimeRange, type RawTimeRangeInput } from '@/lib/glucose/time-range-expressions';
import type { HistorySelection } from '@/lib/glucose/history-cache';
import type { TimeRange } from '@/lib/glucose/time-ranges';

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export type StatisticsDashboardTimeZoneMode = 'browser' | 'utc';

export interface StatisticsDashboardUrlState {
  initialSelection?: HistorySelection;
  initialTimeZone?: string;
}

export interface ParsedStatisticsDashboardUrlState {
  selection: HistorySelection;
  timeZoneMode: StatisticsDashboardTimeZoneMode;
  resolvedTimeZone: string;
  invalid: boolean;
  hasTimeParams: boolean;
}

const PRESET_URL_RAW: Record<TimeRange, RawTimeRangeInput> = {
  '6h': { from: 'now-6h', to: 'now' },
  '12h': { from: 'now-12h', to: 'now' },
  '24h': { from: 'now-24h', to: 'now' },
  '3d': { from: 'now-3d', to: 'now' },
  '7d': { from: 'now-7d', to: 'now' },
  '14d': { from: 'now-14d', to: 'now' },
};

export function getDefaultStatisticsSelection(): HistorySelection {
  return {
    kind: 'preset',
    range: '3d',
  };
}

function readParam(params: SearchParamsLike, key: string): string | null {
  if (params instanceof URLSearchParams) {
    return params.get(key);
  }

  const value = params[key];
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null;
  }

  return null;
}

function resolveTimeZoneMode(value: string | null): StatisticsDashboardTimeZoneMode | null {
  if (!value || value === 'browser') {
    return 'browser';
  }

  if (value === 'utc') {
    return 'utc';
  }

  return null;
}

function parsePresetSelection(raw: RawTimeRangeInput): HistorySelection | null {
  const matchingEntry = Object.entries(PRESET_URL_RAW).find(
    ([, value]) => value.from === raw.from && value.to === raw.to,
  );

  if (!matchingEntry) {
    return null;
  }

  return {
    kind: 'preset',
    range: matchingEntry[0] as TimeRange,
  };
}

export function serializeStatisticsDashboardUrlState(input: {
  selection: HistorySelection;
  timeZoneMode: StatisticsDashboardTimeZoneMode;
}): URLSearchParams {
  const params = new URLSearchParams();
  const raw =
    input.selection.kind === 'preset'
      ? PRESET_URL_RAW[input.selection.range]
      : input.selection.raw ?? input.selection.window;

  params.set('from', raw.from);
  params.set('to', raw.to);
  params.set('timezone', input.timeZoneMode);

  return params;
}

export function parseClientStatisticsDashboardUrlState(
  params: SearchParamsLike,
  browserTimeZone: string,
): ParsedStatisticsDashboardUrlState {
  const from = readParam(params, 'from');
  const to = readParam(params, 'to');
  const timeZoneParam = readParam(params, 'timezone');
  const hasTimeParams = Boolean(from || to || timeZoneParam);
  const timeZoneMode = resolveTimeZoneMode(timeZoneParam);

  if (!hasTimeParams) {
    return {
      selection: getDefaultStatisticsSelection(),
      timeZoneMode: 'browser',
      resolvedTimeZone: browserTimeZone,
      invalid: false,
      hasTimeParams: false,
    };
  }

  if (!from || !to || !timeZoneMode) {
    return {
      selection: getDefaultStatisticsSelection(),
      timeZoneMode: 'browser',
      resolvedTimeZone: browserTimeZone,
      invalid: true,
      hasTimeParams: true,
    };
  }

  const resolvedTimeZone = timeZoneMode === 'utc' ? 'UTC' : browserTimeZone;
  const raw = { from, to };
  const resolved = resolveRawTimeRange(raw, {
    timeZone: resolvedTimeZone,
  });

  if (!resolved || resolved.exceedsSafetyCap) {
    return {
      selection: getDefaultStatisticsSelection(),
      timeZoneMode: 'browser',
      resolvedTimeZone: browserTimeZone,
      invalid: true,
      hasTimeParams: true,
    };
  }

  return {
    selection: parsePresetSelection(raw) ?? {
      kind: 'custom',
      window: resolved.window,
      raw,
    },
    timeZoneMode,
    resolvedTimeZone,
    invalid: false,
    hasTimeParams: true,
  };
}

export function parseStatisticsDashboardUrlState(params: SearchParamsLike): StatisticsDashboardUrlState {
  const parsed = parseClientStatisticsDashboardUrlState(params, 'UTC');

  return {
    initialSelection: parsed.hasTimeParams && !parsed.invalid ? parsed.selection : undefined,
    initialTimeZone: parsed.hasTimeParams && !parsed.invalid ? parsed.resolvedTimeZone : undefined,
  };
}
