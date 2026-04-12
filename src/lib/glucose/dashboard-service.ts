import {
  compressTandemBasalHistory,
  fetchGlucoseHistory,
  fetchGlucoseLatest,
  fetchHealthStepHistory,
  fetchWorkoutHistory,
  fetchTandemBasalHistory,
  fetchTandemEventHistory,
  mergeGlucoseReadings,
  pickLatestGlucoseReading,
  type HealthStepHistoryPoint,
  type MergedGlucosePoint,
  type TandemBasalHistoryPoint,
  type TandemEventHistoryPoint
} from '@/lib/pulse-api/glucose';
import type { PulseApiReading } from '@/lib/pulse-api/types';
import { fetchTimelineNotes, fetchTimelineUpdatesSince } from '@/lib/pulse-api/timeline-notes';
import type {
  ChartPoint,
  GlucoseApiResponse,
  GlucoseUpdatesResponse,
  LatestReading,
  TimelineNote,
  WorkoutChartPoint
} from '@/lib/glucose/types';
import { getTimeRangeHours, type TimeRange } from './time-ranges';

const API_MAX_LIMIT = 1000;
const RESPONSE_MAX_LIMIT = 5000;
const GLUCOSE_CHUNK_MS = 2.5 * 24 * 60 * 60 * 1000;
const TANDEM_CHUNK_MS = 24 * 60 * 60 * 1000;

export interface GlucoseFetchWindow {
  from: string;
  to: string;
  limit: number;
}

export interface GlucoseTimelinePort {
  fetchLatest(source: 'official' | 'share'): Promise<PulseApiReading | null>;
  fetchHistory(
    source: 'official' | 'share',
    window: GlucoseFetchWindow
  ): Promise<PulseApiReading[]>;
}

export interface TandemActivityPort {
  fetchBasal(window: GlucoseFetchWindow): Promise<TandemBasalHistoryPoint[]>;
  fetchEvents(window: GlucoseFetchWindow): Promise<TandemEventHistoryPoint[]>;
}

export interface HealthStepsPort {
  fetchSteps(window: Pick<GlucoseFetchWindow, 'from' | 'to'>): Promise<HealthStepHistoryPoint[]>;
}

export interface WorkoutTimelinePort {
  fetchWorkouts(window: Pick<GlucoseFetchWindow, 'from' | 'to'>): Promise<WorkoutChartPoint[]>;
}

export interface TimelineNotesPort {
  fetchNotes(window: Pick<GlucoseFetchWindow, 'from' | 'to'>): Promise<TimelineNote[]>;
  fetchMutationSummary(since: string): Promise<{ latestRevision: string | null; newCount: number }>;
}

export interface DashboardGlucoseHistoryInput {
  range?: TimeRange | string | null;
  from?: string | null;
  to?: string | null;
  limit?: number | null;
  now?: Date;
}

export interface DashboardGlucoseService {
  getLatest(): Promise<LatestReading | null>;
  getHistory(input: DashboardGlucoseHistoryInput): Promise<GlucoseApiResponse>;
  getUpdatesSince(since: string, now?: Date): Promise<GlucoseUpdatesResponse>;
}

export interface DashboardGlucoseServiceDeps {
  glucosePort: GlucoseTimelinePort;
  tandemPort: TandemActivityPort;
  healthPort: HealthStepsPort;
  workoutPort: WorkoutTimelinePort;
  notesPort: TimelineNotesPort;
  clock?: () => Date;
}

interface ResolvedHistoryWindow {
  from: string;
  to: string;
  hasExplicitRange: boolean;
}

interface MergedWindowData {
  officialItems: PulseApiReading[];
  shareItems: PulseApiReading[];
  tandemBasalItems: TandemBasalHistoryPoint[];
  tandemEventItems: TandemEventHistoryPoint[];
  healthStepItems: HealthStepHistoryPoint[];
  workoutItems: WorkoutChartPoint[];
  noteItems: TimelineNote[];
  merged: MergedGlucosePoint[];
}

interface AttemptResult<T> {
  data: T;
  error: Error | null;
}

export const pulseApiGlucosePort: GlucoseTimelinePort = {
  async fetchLatest(source) {
    return fetchGlucoseLatest(source);
  },
  async fetchHistory(source, window) {
    const response = await fetchGlucoseHistory(source, window.from, window.to, window.limit);
    return response.items;
  }
};

export const pulseApiTandemPort: TandemActivityPort = {
  async fetchBasal(window) {
    const response = await fetchTandemBasalHistory(window.from, window.to, window.limit);
    return response.items;
  },
  async fetchEvents(window) {
    const response = await fetchTandemEventHistory(window.from, window.to, window.limit);
    return response.items;
  }
};

export const pulseApiHealthPort: HealthStepsPort = {
  async fetchSteps(window) {
    const response = await fetchHealthStepHistory(window.from, window.to);
    return response.items;
  }
};

export const pulseApiNotesPort: TimelineNotesPort = {
  async fetchNotes(window) {
    return fetchTimelineNotes(window.from, window.to);
  },
  async fetchMutationSummary(since) {
    const response = await fetchTimelineUpdatesSince(since);
    return {
      latestRevision: response.latestRevision,
      newCount: response.newCount
    };
  }
};

export const pulseApiWorkoutPort: WorkoutTimelinePort = {
  async fetchWorkouts(window) {
    const response = await fetchWorkoutHistory(window.from, window.to);
    return response.items;
  }
};

function normalizeLimit(limit: number | null | undefined): number | null {
  if (!Number.isFinite(limit) || limit == null || limit < 1) {
    return null;
  }

  return Math.min(Math.trunc(limit), RESPONSE_MAX_LIMIT);
}

function resolveHistoryWindow(input: DashboardGlucoseHistoryInput, now: Date): ResolvedHistoryWindow {
  const rangeHours = getTimeRangeHours(input.range);
  if (rangeHours) {
    return {
      from: new Date(now.getTime() - rangeHours * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
      hasExplicitRange: true
    };
  }

  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  return {
    from: input.from || defaultFrom,
    to: input.to || now.toISOString(),
    hasExplicitRange: Boolean(input.from || input.to)
  };
}

async function fetchChunked<T>(
  from: string,
  to: string,
  maxChunkMs: number,
  fetchChunk: (window: GlucoseFetchWindow) => Promise<T[]>
): Promise<T[]> {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const rangeMs = toMs - fromMs;

  if (rangeMs <= maxChunkMs) {
    return fetchChunk({ from, to, limit: API_MAX_LIMIT });
  }

  const chunks: GlucoseFetchWindow[] = [];
  let cursor = fromMs;

  while (cursor < toMs) {
    const chunkEnd = Math.min(cursor + maxChunkMs, toMs);
    chunks.push({
      from: new Date(cursor).toISOString(),
      to: new Date(chunkEnd).toISOString(),
      limit: API_MAX_LIMIT
    });
    cursor = chunkEnd;
  }

  const results = await Promise.all(chunks.map((chunk) => fetchChunk(chunk)));
  return results.flat();
}

function toLatestReading(reading: PulseApiReading, source: 'official' | 'share'): LatestReading {
  return {
    id: reading.id,
    timestamp: reading.timestamp,
    valueMmolL: reading.valueMmolL,
    valueMgDl: reading.valueMgDl,
    trend: reading.trend,
    source,
    originalValueMmolL: reading.originalValueMmolL ?? null,
    originalValueMgDl: reading.originalValueMgDl ?? null,
    isCorrected: reading.isCorrected ?? false,
    correctionReason: reading.correctionReason ?? null
  };
}

function toChartPoint(reading: LatestReading): ChartPoint {
  return {
    readingId: reading.id ?? '',
    timestamp: reading.timestamp,
    valueMmolL: reading.valueMmolL,
    valueMgDl: reading.valueMgDl,
    trend: reading.trend,
    source: reading.source,
    originalValueMmolL: reading.originalValueMmolL ?? null,
    originalValueMgDl: reading.originalValueMgDl ?? null,
    isCorrected: reading.isCorrected ?? false,
    correctionReason: reading.correctionReason ?? null
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function maxIsoDate(...values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function maxWorkoutRevision(workouts: WorkoutChartPoint[]): string | null {
  return workouts.reduce<string | null>((latestWorkout, workout) => {
    return maxIsoDate(latestWorkout, workout.updatedAt ?? null);
  }, null);
}

function countWorkoutMutationsSince(workouts: WorkoutChartPoint[], sinceMs: number): number {
  return workouts.filter((workout) => {
    const updatedAtMs = workout.updatedAt ? new Date(workout.updatedAt).getTime() : Number.NaN;
    return Number.isFinite(updatedAtMs) && updatedAtMs > sinceMs;
  }).length;
}

async function attempt<T>(work: () => Promise<T>, fallback: T): Promise<AttemptResult<T>> {
  try {
    return { data: await work(), error: null };
  } catch (error) {
    return { data: fallback, error: toError(error) };
  }
}

function throwIfAllFailed(label: string, attempts: Array<AttemptResult<unknown>>): void {
  const failures = attempts.filter((entry) => entry.error).map((entry) => entry.error as Error);
  if (failures.length !== attempts.length) {
    return;
  }

  throw new Error(`${label}: ${failures.map((error) => error.message).join(' | ')}`);
}

function buildLatestOnlyHistoryResponse(
  latest: LatestReading | null,
  window: ResolvedHistoryWindow
): GlucoseApiResponse {
  return {
    items: latest ? [toChartPoint(latest)] : [],
    basalItems: [],
    eventItems: [],
    stepItems: [],
    workoutItems: [],
    noteItems: [],
    latest,
    meta: {
      from: window.from,
      to: window.to,
      officialCount: latest?.source === 'official' ? 1 : 0,
      shareCount: latest?.source === 'share' ? 1 : 0,
      mergedCount: latest ? 1 : 0,
      tandemBasalCount: 0,
      tandemEventCount: 0,
      healthStepCount: 0,
      timelineRevision: latest?.timestamp ?? window.to
    }
  };
}

export function createDashboardGlucoseService({
  glucosePort,
  tandemPort,
  healthPort,
  workoutPort,
  notesPort,
  clock = () => new Date()
}: DashboardGlucoseServiceDeps): DashboardGlucoseService {
  async function getLatest(optional = false): Promise<LatestReading | null> {
    const [officialResult, shareResult] = await Promise.all([
      attempt(() => glucosePort.fetchLatest('official'), null),
      attempt(() => glucosePort.fetchLatest('share'), null)
    ]);

    if (!optional) {
      throwIfAllFailed('Failed to load latest glucose reading', [officialResult, shareResult]);
    }

    const latestOfficial = officialResult.data;
    const latestShare = shareResult.data;

    const latest = pickLatestGlucoseReading(latestOfficial, latestShare);
    if (!latest) {
      return null;
    }

    return toLatestReading(latest, latest === latestOfficial ? 'official' : 'share');
  }

  async function fetchMergedWindow(from: string, to: string): Promise<MergedWindowData> {
    const [officialResult, shareResult] = await Promise.all([
      attempt(
        () => fetchChunked(from, to, GLUCOSE_CHUNK_MS, (window) => glucosePort.fetchHistory('official', window)),
        [] as PulseApiReading[]
      ),
      attempt(
        () => fetchChunked(from, to, GLUCOSE_CHUNK_MS, (window) => glucosePort.fetchHistory('share', window)),
        [] as PulseApiReading[]
      )
    ]);
    throwIfAllFailed('Failed to load glucose history', [officialResult, shareResult]);

    const officialItems = officialResult.data;
    const shareItems = shareResult.data;

    const [tandemBasal, tandemEvents, healthStepItems, workoutItems, noteItems] = await Promise.all([
      fetchChunked(from, to, TANDEM_CHUNK_MS, (window) => tandemPort.fetchBasal(window)).catch(
        () => [] as TandemBasalHistoryPoint[]
      ),
      fetchChunked(from, to, TANDEM_CHUNK_MS, (window) => tandemPort.fetchEvents(window)).catch(
        () => [] as TandemEventHistoryPoint[]
      ),
      healthPort.fetchSteps({ from, to }).catch(() => [] as HealthStepHistoryPoint[]),
      workoutPort.fetchWorkouts({ from, to }).catch(() => [] as WorkoutChartPoint[]),
      notesPort.fetchNotes({ from, to }).catch(() => [] as TimelineNote[])
    ]);

    return {
      officialItems,
      shareItems,
      tandemBasalItems: compressTandemBasalHistory(tandemBasal),
      tandemEventItems: tandemEvents,
      healthStepItems,
      workoutItems,
      noteItems,
      merged: mergeGlucoseReadings(officialItems, shareItems)
    };
  }

  return {
    async getLatest() {
      return getLatest();
    },

    async getHistory(input) {
      const now = input.now ?? clock();
      const requestedLimit = normalizeLimit(input.limit);
      const window = resolveHistoryWindow(input, now);
      const latest = await getLatest(true);

      if (!window.hasExplicitRange && requestedLimit === 1) {
        if (!latest) {
          throw new Error('Failed to load latest glucose reading');
        }
        return buildLatestOnlyHistoryResponse(latest, window);
      }

      const {
        officialItems,
        shareItems,
        tandemBasalItems,
        tandemEventItems,
        healthStepItems,
        workoutItems,
        noteItems,
        merged
      } = await fetchMergedWindow(window.from, window.to);
      const items = requestedLimit ? merged.slice(-requestedLimit) : merged;
      const resolvedLatest =
        latest ||
        (items.length > 0
          ? {
              id: items[items.length - 1].readingId,
              timestamp: items[items.length - 1].timestamp,
              valueMmolL: items[items.length - 1].valueMmolL,
              valueMgDl: items[items.length - 1].valueMgDl ?? 0,
              trend: items[items.length - 1].trend ?? 'unknown',
              source: items[items.length - 1].source,
              originalValueMmolL: items[items.length - 1].originalValueMmolL ?? null,
              originalValueMgDl: items[items.length - 1].originalValueMgDl ?? null,
              isCorrected: items[items.length - 1].isCorrected ?? false,
              correctionReason: items[items.length - 1].correctionReason ?? null
            }
          : null);

      return {
        items,
        basalItems: tandemBasalItems,
        eventItems: tandemEventItems,
        stepItems: healthStepItems,
        workoutItems,
        noteItems,
        latest: resolvedLatest,
        meta: {
          from: window.from,
          to: window.to,
          officialCount: officialItems.length,
          shareCount: shareItems.length,
          mergedCount: items.length,
          tandemBasalCount: tandemBasalItems.length,
          tandemEventCount: tandemEventItems.length,
          healthStepCount: healthStepItems.length,
          timelineRevision: maxIsoDate(
            resolvedLatest?.timestamp ?? null,
            tandemBasalItems.at(-1)?.timestamp ?? null,
            tandemEventItems.at(-1)?.timestamp ?? null,
            maxWorkoutRevision(workoutItems),
            noteItems.reduce<string | null>((latestNote, note) => maxIsoDate(latestNote, note.updatedAt), null)
          ) ?? window.to
        }
      };
    },

    async getUpdatesSince(since, now = clock()) {
      const sinceMs = new Date(since).getTime();
      if (Number.isNaN(sinceMs)) {
        throw new Error('Invalid since parameter');
      }

      const latest = await getLatest(true);
      const nowIso = now.toISOString();
      if (sinceMs >= now.getTime()) {
        return {
          latest,
          meta: {
            since,
            to: nowIso,
            newCount: 0
          }
        };
      }

      const from = new Date(sinceMs + 1).toISOString();
      const { merged, tandemBasalItems, tandemEventItems, workoutItems } = await fetchMergedWindow(from, nowIso);
      const noteMutations = await notesPort.fetchMutationSummary(since);
      const newTandemBasalCount = tandemBasalItems.filter(
        (item) => new Date(item.timestamp).getTime() > sinceMs
      ).length;
      const newTandemEventCount = tandemEventItems.filter(
        (item) => new Date(item.timestamp).getTime() > sinceMs
      ).length;
      const newWorkoutMutationCount = countWorkoutMutationsSince(workoutItems, sinceMs);

      return {
        latest,
        meta: {
          since,
          to: nowIso,
          newCount: merged.length + newWorkoutMutationCount + newTandemBasalCount + newTandemEventCount + noteMutations.newCount,
          newGlucoseCount: merged.length,
          newWorkoutMutationCount,
          newTandemBasalCount,
          newTandemEventCount,
          newNoteMutationCount: noteMutations.newCount,
          timelineRevision: maxIsoDate(
            latest?.timestamp ?? null,
            tandemBasalItems.at(-1)?.timestamp ?? null,
            tandemEventItems.at(-1)?.timestamp ?? null,
            maxWorkoutRevision(workoutItems),
            noteMutations.latestRevision
          ) ?? nowIso
        }
      };
    }
  };
}

export const dashboardGlucoseService = createDashboardGlucoseService({
  glucosePort: pulseApiGlucosePort,
  tandemPort: pulseApiTandemPort,
  healthPort: pulseApiHealthPort,
  workoutPort: pulseApiWorkoutPort,
  notesPort: pulseApiNotesPort
});
