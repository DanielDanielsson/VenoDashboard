'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { GlucoseChart } from '@ui/components/GlucoseChart/GlucoseChart';
import { GlucoseAgpChart } from '@ui/components/GlucoseAgpChart/GlucoseAgpChart';
import { DashboardTimeRangePicker } from '@ui/components/DashboardTimeRangePicker';
import { DashboardRefreshPicker } from '@ui/components/DashboardRefreshPicker';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { DialogPanel } from '@ui/components/DialogPanel';
import { FloatingPanel } from '@ui/components/FloatingPanel';
import { DashboardViewPanelUrlStateBridge } from '@ui/compositions/DashboardViewPanelUrlStateBridge/DashboardViewPanelUrlStateBridge';
import { TimeInRangePanel, createTimeInRangePanelSettingsRegistration } from '@ui/compositions/TimeInRangePanel';
import { WorkoutTypePanel } from '@ui/compositions/WorkoutTypePanel';
import {
  useDashboardPanelSettings,
  type DashboardPanelSettingsRegistry,
} from '@ui/compositions/DashboardGrid';
import { DashboardDefinitionRenderer } from '@ui/compositions/DashboardDefinitionRenderer';
import { NumberInput } from '@ui/components/NumberInput';
import { SegmentedControl } from '@ui/components/SegmentedControl';
import { createPanelRegistry } from '@/lib/dashboard/panel-registry';
import { getDashboardDefinition } from '@/lib/dashboard/registry';
import type { DashboardDefinition } from '@/lib/dashboard/schema';
import {
  getDefaultStatisticsSelection,
  parseClientStatisticsDashboardUrlState,
  serializeStatisticsDashboardUrlState,
  type StatisticsDashboardTimeZoneMode,
} from '@/lib/dashboard/url-state';
import { getDashboardViewPanelAliases } from '@/lib/dashboard/view-panel';
import { GLUCOSE_COLOR_MODES, type GlucoseColorMode } from '@/lib/glucose/tints';
import { computeGlucoseStats } from '@/lib/glucose/metrics';
import { getTimelineNoteBandHeight } from '@/lib/glucose/timeline-note-layout';
import {
  createTimelineNoteDraft,
  draftFromTimelineNote,
  isMultiDayTimelineNoteDraft,
  validateTimelineNoteDraft,
  type TimelineNoteDraft
} from '@/lib/glucose/timeline-note-form';
import {
  NORMALIZED_WORKOUT_TYPES,
  createWorkoutDraft,
  draftFromWorkout,
  validateWorkoutDraft,
  type WorkoutDraft
} from '@/lib/glucose/workout-form';
import {
  buildPresetWindow,
  getHistoryCustomKey,
  getHistoryRangeKey,
  pickBestLoadedSourceKey,
  sliceHistoryResponseToWindow,
  type HistorySelection,
  type HistoryWindow
} from '@/lib/glucose/history-cache';
import {
  buildDisplayedTimelineNotes,
  removeTimelineNoteFromHistoryResponse,
  upsertTimelineNoteInHistoryResponse
} from '@/lib/glucose/timeline-note-history';
import {
  removeWorkoutFromHistoryResponse,
  upsertWorkoutInHistoryResponse
} from '@/lib/glucose/workout-history';
import {
  formatWorkoutDuration,
  formatWorkoutMetrics,
  formatWorkoutTimeRange,
  getWorkoutDisplayLabel,
  getWorkoutSourceLabel
} from '@/lib/glucose/workout-display';
import { SecondaryButton } from '@ui/components/SecondaryButton';
import type {
  ChartPoint,
  GlucoseApiResponse,
  GlucoseUpdatesResponse,
  TimelineNote,
  WorkoutChartPoint
} from '@/lib/glucose/types';
import type { ConsumerProfileResponse } from '@/lib/pulse-api/types';
import { useDashboardNotifications } from '@ui/compositions/DashboardDefinitionRenderer/useDashboardNotifications';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const json = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(json.error?.message || 'Request failed');
  }

  return json;
}

const DEFAULT_GLUCOSE_CHART_COLOR_MODE: GlucoseColorMode = 'threeColors';
const GLUCOSE_TIMELINE_PANEL_ID = 'panel-glucose-timeline';
const STATISTICS_DASHBOARD_EDIT_CONTROLS_ID = 'statistics-dashboard-edit-controls';

type GlucoseTimelinePanelSettings = {
  colorMode: GlucoseColorMode;
  yAxisMax: number;
};

interface StatisticsDashboardContext {
  renderAverageGlucosePanel: () => ReactNode;
  renderTimeInRangePanel: () => ReactNode;
  renderWorkoutTypesPanel: () => ReactNode;
  renderGlucoseTimelinePanel: () => ReactNode;
  renderAgpPanel: () => ReactNode;
}

const DEFAULT_GLUCOSE_TIMELINE_PANEL_SETTINGS: GlucoseTimelinePanelSettings = {
  colorMode: DEFAULT_GLUCOSE_CHART_COLOR_MODE,
  yAxisMax: 25,
};

const statisticsPanelRegistry = createPanelRegistry<StatisticsDashboardContext>([
  {
    group: 'veno.average-glucose',
    render: ({ context }) => context.renderAverageGlucosePanel(),
  },
  {
    group: 'veno.time-in-range',
    render: ({ context }) => context.renderTimeInRangePanel(),
  },
  {
    group: 'veno.workout-types',
    render: ({ context }) => context.renderWorkoutTypesPanel(),
  },
  {
    group: 'veno.glucose-timeline',
    render: ({ context }) => context.renderGlucoseTimelinePanel(),
  },
  {
    group: 'veno.glucose-agp',
    render: ({ context }) => context.renderAgpPanel(),
  },
]);

function getUpdatesKey(revision: string): string {
  return `/api/dashboard/glucose/updates?since=${encodeURIComponent(revision)}`;
}

function getSelectionTargetWindow(
  selection: HistorySelection,
  sourceData: GlucoseApiResponse | undefined
): HistoryWindow | null {
  if (selection.kind === 'custom') {
    return selection.window;
  }

  if (!sourceData) {
    return null;
  }

  return buildPresetWindow(sourceData.meta.to, selection.range);
}

function parseChartYMax(yAxisMax: number): number {
  const parsed = Number(yAxisMax);
  return Number.isFinite(parsed) ? Math.max(12, parsed) : 25;
}

function roundCorrectionValue(value: number): number {
  return Number(value.toFixed(1));
}

function getTimelineNoteSignature(note: TimelineNote | null): string | null {
  if (!note) {
    return null;
  }

  return [
    note.id,
    note.text,
    note.startAt,
    note.endAt,
    note.timezone,
    String(note.allDay),
    note.authorType,
    note.source ?? '',
    note.createdAt,
    note.updatedAt,
    note.createdBy,
    note.updatedBy
  ].join('|');
}

function wasTimelineNoteEdited(note: TimelineNote): boolean {
  return note.updatedAt !== note.createdAt || note.updatedBy !== note.createdBy;
}

function GlucoseTimelineSettingsFields({
  settings,
  updateSettings,
}: {
  settings: GlucoseTimelinePanelSettings;
  updateSettings: (updater: (current: GlucoseTimelinePanelSettings) => GlucoseTimelinePanelSettings) => void;
}): ReactElement {
  return (
    <div className="flex items-end gap-4">
      <div className="grid gap-2">
        <span className="ui_micro_label text-text-soft">Color Mode</span>
        <SegmentedControl
          options={GLUCOSE_COLOR_MODES}
          value={settings.colorMode}
          onChange={(value) => {
            updateSettings((current) => ({ ...current, colorMode: value }));
          }}
        />
      </div>
      <div className="grid gap-2">
        <span className="ui_micro_label text-text-soft">Y-Axis Max</span>
        <NumberInput
          label="Top"
          value={String(settings.yAxisMax)}
          min={12}
          onChange={(value) => {
            const parsed = Number(value);
            updateSettings((current) => ({
              ...current,
              yAxisMax: Number.isFinite(parsed) ? parsed : current.yAxisMax,
            }));
          }}
          ariaLabel="Chart top value in mmol/L"
        />
      </div>
    </div>
  );
}

function GlucoseTimelineChart(
  props: Omit<ComponentProps<typeof GlucoseChart>, 'colorMode' | 'yMax'>,
): ReactElement {
  const [settings] = useDashboardPanelSettings(
    GLUCOSE_TIMELINE_PANEL_ID,
    DEFAULT_GLUCOSE_TIMELINE_PANEL_SETTINGS,
  );

  return (
    <GlucoseChart
      {...props}
      colorMode={settings.colorMode}
      yMax={parseChartYMax(settings.yAxisMax)}
    />
  );
}

function GlucoseAgpWithPanelSettings(
  props: Omit<ComponentProps<typeof GlucoseAgpChart>, 'yMax'>,
): ReactElement {
  const [settings] = useDashboardPanelSettings(
    GLUCOSE_TIMELINE_PANEL_ID,
    DEFAULT_GLUCOSE_TIMELINE_PANEL_SETTINGS,
  );

  return <GlucoseAgpChart {...props} yMax={parseChartYMax(settings.yAxisMax)} />;
}

function formatWorkoutDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getChartHeight(
  data: Pick<GlucoseApiResponse, 'basalItems' | 'eventItems' | 'stepItems' | 'workoutItems' | 'noteItems'> | undefined
): number {
  const glucosePlotHeight = 240;
  const paddingTop = 32;
  const paddingBottom = 48;
  const bandHeight = 120;
  const bandGap = 20;

  let totalHeight = paddingTop + glucosePlotHeight + paddingBottom;

  if (data?.eventItems.length) {
    totalHeight += bandGap + bandHeight;
  }

  if (data?.basalItems.length) {
    totalHeight += bandGap + bandHeight;
  }

  if (data?.stepItems.length) {
    totalHeight += bandGap + bandHeight;
  }

  totalHeight += bandGap + 44;

  totalHeight += bandGap + getTimelineNoteBandHeight(data?.noteItems ?? []);

  return totalHeight;
}

function getSelectionSignature(selection: HistorySelection): string {
  return JSON.stringify(selection);
}

export function GlucoseAnalysisView({
  isOwner = false,
  initialSnapshot,
  dashboardDefinition = getDashboardDefinition('statistics'),
  dashboardVersion = null,
  initialSelection,
  initialTimeZone,
}: {
  isOwner?: boolean;
  initialSnapshot?: GlucoseApiResponse;
  dashboardDefinition?: DashboardDefinition;
  dashboardVersion?: number | null;
  initialSelection?: HistorySelection;
  initialTimeZone?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [selection, setSelection] = useState<HistorySelection>(
    initialSelection ?? {
      kind: 'preset',
      range: '3d'
    },
  );
  const [timeZoneMode, setTimeZoneMode] = useState<StatisticsDashboardTimeZoneMode | null>(
    initialTimeZone === 'UTC' ? 'utc' : null,
  );
  const [autoRefresh, setAutoRefresh] = useState(dashboardDefinition.spec.timeSettings.autoRefresh);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const read = () => document.documentElement.classList.contains('theme-dark');
    const handleChange = () => setIsDark(read());
    handleChange();
    window.addEventListener('pulse-theme-change', handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener('pulse-theme-change', handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);
  const [selectedPoints, setSelectedPoints] = useState<ChartPoint[]>([]);
  const [previewCorrectionValues, setPreviewCorrectionValues] = useState<Record<string, number>>({});
  const [correctionReasonInput, setCorrectionReasonInput] = useState('');
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutDraft | null>(null);
  const [workoutInitialDraft, setWorkoutInitialDraft] = useState<WorkoutDraft | null>(null);
  const [workoutLastValidPreview, setWorkoutLastValidPreview] = useState<WorkoutChartPoint | null>(null);
  const [workoutMode, setWorkoutMode] = useState<'create' | 'edit' | 'read'>('read');
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [isConfirmingWorkoutDelete, setIsConfirmingWorkoutDelete] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<TimelineNoteDraft | null>(null);
  const [noteInitialDraft, setNoteInitialDraft] = useState<TimelineNoteDraft | null>(null);
  const [noteLastValidPreview, setNoteLastValidPreview] = useState<TimelineNote | null>(null);
  const [noteMode, setNoteMode] = useState<'create' | 'edit' | 'read'>('read');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [hasAttemptedNoteSave, setHasAttemptedNoteSave] = useState(false);
  const [deletedNoteIds, setDeletedNoteIds] = useState<string[]>([]);

  const isApplyingUpdatesRef = useRef(false);
  const lastInvalidSearchRef = useRef<string | null>(null);
  const noteValidationPreviewRef = useRef<TimelineNote | null>(null);
  const noteTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const { notifyInvalidDashboardUrl } = useDashboardNotifications({ dashboardUid: dashboardDefinition.spec.uid });
  const { cache } = useSWRConfig();
  const loadedSourceKey = pickBestLoadedSourceKey(cache, selection);
  const requestKey =
    selection.kind === 'preset'
      ? getHistoryRangeKey(selection.range)
      : getHistoryCustomKey(selection.window);
  const sourceKey = loadedSourceKey ?? requestKey;

  const {
    data: sourceDataResponse,
    error,
    isLoading,
    isValidating,
    mutate
  } = useSWR<GlucoseApiResponse>(sourceKey, fetchJson, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    keepPreviousData: true
  });
  const { data: profileResponse } = useSWR<ConsumerProfileResponse>(
    isOwner ? '/api/dashboard/settings/profile' : null,
    fetchJson,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  );

  const sourceData = sourceDataResponse ?? (sourceKey === getHistoryRangeKey('3d') ? initialSnapshot : undefined);
  const targetWindow = getSelectionTargetWindow(selection, sourceData);
  const dashboardTimeSettings = useMemo(
    () => ({
      ...dashboardDefinition.spec.timeSettings,
      autoRefresh,
    }),
    [autoRefresh, dashboardDefinition.spec.timeSettings],
  );
  const data = sourceData && targetWindow
    ? sliceHistoryResponseToWindow(sourceData, targetWindow)
    : sourceData;
  const visibleSavedNoteItems = buildDisplayedTimelineNotes(data?.noteItems, {
    deletedIds: deletedNoteIds
  });
  const activeWorkout = data?.workoutItems?.find((workout) => workout.id === activeWorkoutId) ?? null;
  const activeWorkoutMetrics = activeWorkout ? formatWorkoutMetrics(activeWorkout) : [];
  const workoutValidation = workoutDraft
    ? validateWorkoutDraft(workoutDraft, activeWorkout ?? workoutLastValidPreview)
    : null;
  const activeSavedNote = visibleSavedNoteItems.find((note) => note.id === activeNoteId) ?? null;
  const noteValidation = noteDraft
    ? validateTimelineNoteDraft(noteDraft, activeSavedNote ?? noteLastValidPreview)
    : null;
  const notePreviewSignature = getTimelineNoteSignature(noteValidation?.preview ?? null);
  noteValidationPreviewRef.current = noteValidation?.preview ?? null;
  const displayedNoteItems = buildDisplayedTimelineNotes(visibleSavedNoteItems, {
    previewNote: noteLastValidPreview
  });

  const displayData = data
    ? {
        ...data,
        noteItems: displayedNoteItems
      }
    : data;
  const chartHeight = getChartHeight(displayData);

  const isTransitioning = isValidating || isLoading;
  const isFirstLoad = !data && isLoading;
  const ownerTimeZone =
    timeZoneMode === 'utc'
      ? 'UTC'
      : timeZoneMode === 'browser'
      ? browserTimeZone
      : initialTimeZone ||
        profileResponse?.profile?.timezone ||
        browserTimeZone;

  const displayedTimelineRevision = selection.kind === 'preset'
    ? displayData?.meta.timelineRevision ?? displayData?.latest?.timestamp ?? null
    : null;
  const {
    data: updates,
    error: updatesError
  } = useSWR<GlucoseUpdatesResponse>(
    displayedTimelineRevision ? getUpdatesKey(displayedTimelineRevision) : null,
    fetchJson,
    {
      refreshInterval: 2 * 60 * 1000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  );

  useEffect(() => {
    if (data?.latest) {
      globalThis.dispatchEvent(new CustomEvent('pulse-glucose-latest', { detail: data.latest }));
    }
  }, [data?.latest]);

  const stats = computeGlucoseStats(data?.items ?? []);
  const newUpdatesCount = updates?.meta.newCount ?? 0;

  const settingsRegistry = useMemo<DashboardPanelSettingsRegistry>(
    () => ({
      [GLUCOSE_TIMELINE_PANEL_ID]: {
        defaultSettings: DEFAULT_GLUCOSE_TIMELINE_PANEL_SETTINGS,
        render: ({ settings, updateSettings }) => (
          <GlucoseTimelineSettingsFields
            settings={settings as GlucoseTimelinePanelSettings}
            updateSettings={updateSettings as (updater: (current: GlucoseTimelinePanelSettings) => GlucoseTimelinePanelSettings) => void}
          />
        ),
      },
      'panel-time-in-range': createTimeInRangePanelSettingsRegistration('statistics'),
    }),
    [],
  );

  const refreshDashboard = useCallback(async () => {
    await mutate();
  }, [mutate]);

  useEffect(() => {
    setAutoRefresh(dashboardDefinition.spec.timeSettings.autoRefresh);
  }, [dashboardDefinition.spec.timeSettings.autoRefresh]);

  useEffect(() => {
    const parsed = parseClientStatisticsDashboardUrlState(searchParams, browserTimeZone);
    const currentSearch = searchParams.toString();

    if (!parsed.hasTimeParams) {
      const fallbackSelection = getDefaultStatisticsSelection();

      lastInvalidSearchRef.current = null;
      setSelection((current) => (
        getSelectionSignature(current) === getSelectionSignature(fallbackSelection)
          ? current
          : fallbackSelection
      ));
      setTimeZoneMode((current) => (current === null ? current : null));
      return;
    }

    if (parsed.invalid) {
      const fallbackSelection = getDefaultStatisticsSelection();
      const fallbackSearch = serializeStatisticsDashboardUrlState({
        selection: fallbackSelection,
        timeZoneMode: 'browser',
      }).toString();

      setSelection((current) => (
        getSelectionSignature(current) === getSelectionSignature(fallbackSelection)
          ? current
          : fallbackSelection
      ));
      setTimeZoneMode((current) => (current === 'browser' ? current : 'browser'));

      if (currentSearch !== fallbackSearch) {
        router.replace(`${pathname}?${fallbackSearch}`);
      }

      if (lastInvalidSearchRef.current !== currentSearch) {
        notifyInvalidDashboardUrl(dashboardDefinition.spec.title);
        lastInvalidSearchRef.current = currentSearch;
      }

      return;
    }

    lastInvalidSearchRef.current = null;
    setSelection((current) => (
      getSelectionSignature(current) === getSelectionSignature(parsed.selection)
        ? current
        : parsed.selection
    ));
    setTimeZoneMode((current) => (current === parsed.timeZoneMode ? current : parsed.timeZoneMode));
  }, [
    browserTimeZone,
    dashboardDefinition.spec.title,
    notifyInvalidDashboardUrl,
    pathname,
    router,
    searchParams,
  ]);

  function applyHistorySelection(nextSelection: HistorySelection) {
    if (!confirmDiscardNoteDraft()) {
      return;
    }

    closeNoteEditor();
    const nextTimeZoneMode = timeZoneMode ?? 'browser';
    const nextTimeParams = serializeStatisticsDashboardUrlState({
      selection: nextSelection,
      timeZoneMode: nextTimeZoneMode,
    });
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set('from', nextTimeParams.get('from') ?? '');
    nextParams.set('to', nextTimeParams.get('to') ?? '');
    nextParams.set('timezone', nextTimeParams.get('timezone') ?? nextTimeZoneMode);

    const nextSearch = nextParams.toString();

    if (searchParams.toString() === nextSearch) {
      return;
    }

    window.history.replaceState(null, '', `${pathname}?${nextSearch}`);
  }

  useEffect(() => {
    if (selection.kind !== 'preset') {
      return;
    }

    if (!displayedTimelineRevision || newUpdatesCount <= 0 || isApplyingUpdatesRef.current || isValidating) {
      return;
    }

    isApplyingUpdatesRef.current = true;
    void mutate().finally(() => {
      isApplyingUpdatesRef.current = false;
    });
  }, [
    displayedTimelineRevision,
    isValidating,
    mutate,
    newUpdatesCount,
    selection.kind
  ]);

  const lowColor  = isDark ? '#fb7185' : '#be123c';
  const highColor = isDark ? '#a855f7' : '#7e22ce';
  const normColor = isDark ? '#34d399' : '#059669';
  const avgColor  = stats.avg < 4 ? lowColor : stats.avg > 10 ? highColor : normColor;

  const hasData = !error && data && data.items.length > 0;
  const selectedReadingIds = selectedPoints
    .map((point) => point.readingId)
    .filter((readingId): readingId is string => Boolean(readingId));
  const hasPreviewCorrection = selectedReadingIds.some((readingId) => previewCorrectionValues[readingId] !== undefined);
  const canRemoveCorrection = selectedPoints.length > 0
    && selectedPoints.every((point) => point.isCorrected && point.readingId);
  const trimmedCorrectionReason = correctionReasonInput.trim();
  const isCorrectionReasonMissing = trimmedCorrectionReason.length === 0;
  const noteDraftIsDirty = noteDraft && noteInitialDraft
    ? JSON.stringify(noteDraft) !== JSON.stringify(noteInitialDraft)
    : false;
  const isMultiDayNoteDraft = noteDraft ? isMultiDayTimelineNoteDraft(noteDraft) : false;
  const isNoteReadOnly = !isOwner || noteMode === 'read';
  const isWorkoutReadOnly = !isOwner || workoutMode === 'read';
  const workoutDraftIsDirty = workoutDraft && workoutInitialDraft
    ? JSON.stringify(workoutDraft) !== JSON.stringify(workoutInitialDraft)
    : false;
  const activePanelNote = noteLastValidPreview ?? activeSavedNote;
  const activePanelWorkout = workoutLastValidPreview ?? activeWorkout;

  useEffect(() => {
    if (!data?.items.length) {
      setSelectedPoints((current) => (current.length === 0 ? current : []));
      setPreviewCorrectionValues((current) =>
        Object.keys(current).length === 0 ? current : {}
      );
      setCorrectionReasonInput((current) => (current === '' ? current : ''));
      return;
    }

    const itemMap = new Map(data.items.map((item) => [item.readingId, item]));
    setSelectedPoints((current) => {
      const next = current
        .map((point) => itemMap.get(point.readingId))
        .filter((point): point is ChartPoint => Boolean(point));

      if (
        next.length === current.length &&
        next.every((point, index) => point.readingId === current[index]?.readingId)
      ) {
        return current;
      }

      return next;
    });
    setPreviewCorrectionValues((current) => {
      const nextEntries = Object.entries(current).filter(([readingId]) => itemMap.has(readingId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [data?.items]);

  useEffect(() => {
    const preview = noteValidationPreviewRef.current;
    if (!preview) {
      return;
    }

    setNoteLastValidPreview((current) =>
      getTimelineNoteSignature(current) === notePreviewSignature ? current : preview
    );
  }, [notePreviewSignature]);

  useEffect(() => {
    if (noteMode !== 'create' || !noteDraft || isNoteReadOnly) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      noteTextAreaRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isNoteReadOnly, noteDraft, noteMode]);

  useEffect(() => {
    if (!activeNoteId || !data?.noteItems) {
      return;
    }

    const nextActive = data.noteItems.find((note) => note.id === activeNoteId);
    if (!nextActive && !noteDraft) {
      setActiveNoteId(null);
      setNoteLastValidPreview(null);
      setNoteInitialDraft(null);
    }
  }, [activeNoteId, data?.noteItems, noteDraft]);

  useEffect(() => {
    if (!activeWorkoutId || !data?.workoutItems) {
      return;
    }

    if (!data.workoutItems.some((workout) => workout.id === activeWorkoutId)) {
      setActiveWorkoutId(null);
    }
  }, [activeWorkoutId, data?.workoutItems]);

  useEffect(() => {
    if (!noteDraft || !isMultiDayTimelineNoteDraft(noteDraft) || noteDraft.allDay) {
      return;
    }

    setNoteDraft((current) => {
      if (!current || !isMultiDayTimelineNoteDraft(current) || current.allDay) {
        return current;
      }

      return {
        ...current,
        allDay: true,
        startTime: '',
        endTime: ''
      };
    });
  }, [noteDraft]);

  useEffect(() => {
    if (selectedReadingIds.length === 0) {
      setPreviewCorrectionValues((current) =>
        Object.keys(current).length === 0 ? current : {}
      );
      setCorrectionReasonInput((current) => (current === '' ? current : ''));
      return;
    }

    setPreviewCorrectionValues((current) => {
      const selectedReadingIdSet = new Set(selectedReadingIds);
      const nextEntries = Object.entries(current).filter(([readingId]) => selectedReadingIdSet.has(readingId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [selectedReadingIds]);

  function closeNoteEditor() {
    setActiveNoteId(null);
    setNoteDraft(null);
    setNoteInitialDraft(null);
    setNoteLastValidPreview(null);
    setNoteMode('read');
    setNoteError(null);
    setHasAttemptedNoteSave(false);
    setIsConfirmingDelete(false);
  }

  function closeWorkoutDialog() {
    setActiveWorkoutId(null);
    setWorkoutDraft(null);
    setWorkoutInitialDraft(null);
    setWorkoutLastValidPreview(null);
    setWorkoutMode('read');
    setWorkoutError(null);
    setIsConfirmingWorkoutDelete(false);
  }

  function confirmDiscardNoteDraft(): boolean {
    if (!noteDraftIsDirty) {
      return true;
    }

    return window.confirm('Discard unsaved note changes?');
  }

  function clearCorrectionEditor() {
    setSelectedPoints([]);
    setPreviewCorrectionValues({});
    setCorrectionReasonInput('');
    setCorrectionError(null);
  }

  function handleNoteSelect(note: TimelineNote) {
    if (!confirmDiscardNoteDraft()) {
      return;
    }

    clearCorrectionEditor();
    closeWorkoutDialog();
    const draft = draftFromTimelineNote(note);
    setActiveNoteId(note.id);
    setNoteDraft(draft);
    setNoteInitialDraft(draft);
    setNoteLastValidPreview(note);
    setNoteMode(isOwner ? 'edit' : 'read');
    setNoteError(null);
    setHasAttemptedNoteSave(false);
    setIsConfirmingDelete(false);
  }

  function handleWorkoutSelect(workout: WorkoutChartPoint) {
    if (!confirmDiscardNoteDraft()) {
      return;
    }

    clearCorrectionEditor();
    closeNoteEditor();
    setActiveWorkoutId(workout.id);
    if (isOwner) {
      const draft = draftFromWorkout(workout, ownerTimeZone);
      setWorkoutDraft(draft);
      setWorkoutInitialDraft(draft);
      setWorkoutLastValidPreview(workout);
    } else {
      setWorkoutDraft(null);
      setWorkoutInitialDraft(null);
      setWorkoutLastValidPreview(null);
    }
    setWorkoutMode(isOwner ? 'edit' : 'read');
    setWorkoutError(null);
    setIsConfirmingWorkoutDelete(false);
  }

  function handleWorkoutAddRequest(hoveredAt: string | null) {
    if (!isOwner) {
      return;
    }

    if (!confirmDiscardNoteDraft()) {
      return;
    }

    clearCorrectionEditor();
    closeNoteEditor();
    const draft = createWorkoutDraft(ownerTimeZone, hoveredAt);
    setActiveWorkoutId(null);
    setWorkoutDraft(draft);
    setWorkoutInitialDraft(draft);
    setWorkoutLastValidPreview(null);
    setWorkoutMode('create');
    setWorkoutError(null);
    setIsConfirmingWorkoutDelete(false);
  }

  function handleNoteAddRequest(hoveredAt: string | null) {
    if (!confirmDiscardNoteDraft()) {
      return;
    }

    clearCorrectionEditor();
    closeWorkoutDialog();
    const draft = createTimelineNoteDraft(ownerTimeZone, hoveredAt);
    setActiveNoteId(null);
    setNoteDraft(draft);
    setNoteInitialDraft(draft);
    setNoteLastValidPreview(null);
    setNoteMode(isOwner ? 'create' : 'read');
    setNoteError(null);
    setHasAttemptedNoteSave(false);
    setIsConfirmingDelete(false);
  }

  function handlePointSelect(point: ChartPoint, additive: boolean) {
    if (!isNoteReadOnly && noteDraft) {
      if (!confirmDiscardNoteDraft()) {
        return;
      }
      closeNoteEditor();
    }

    closeWorkoutDialog();
    const readingId = point.readingId;
    const hasActiveCorrectionSession = selectedPoints.length > 0 || Object.keys(previewCorrectionValues).length > 0;
    const shouldAddToSession = additive || hasActiveCorrectionSession;
    const isAlreadySelected = Boolean(readingId) && selectedPoints.some((item) => item.readingId === readingId);
    const shouldSeedReason = !shouldAddToSession && !isAlreadySelected;

    setCorrectionError(null);
    if (shouldSeedReason) {
      setCorrectionReasonInput(point.correctionReason ?? '');
    }
    setSelectedPoints((current) => {
      if (shouldAddToSession) {
        const exists = current.some((item) => item.readingId === point.readingId);
        if (exists) {
          return current.filter((item) => item.readingId !== point.readingId);
        }
        return [...current, point];
      }

      return [point];
    });
    setPreviewCorrectionValues((current) => {
      if (!readingId) {
        return shouldAddToSession ? current : {};
      }

      if (shouldAddToSession) {
        if (!isAlreadySelected) {
          return current;
        }

        const next = { ...current };
        delete next[readingId];
        return next;
      }

      if (current[readingId] === undefined) {
        return {};
      }

      return { [readingId]: current[readingId] };
    });
  }

  function handleCorrectionPreviewChange(items: Array<{ readingId: string; valueMmolL: number }>) {
    setCorrectionError(null);
    setPreviewCorrectionValues((current) => ({
      ...current,
      ...Object.fromEntries(
        items.map((item) => [item.readingId, roundCorrectionValue(item.valueMmolL)])
      )
    }));
  }

  async function submitCorrection() {
    if (!isOwner || !selectedPoints.length) {
      if (!isOwner) {
        setCorrectionError('Admin sign in is required to apply glucose corrections.');
      }
      return;
    }

    if (isCorrectionReasonMissing) {
      setCorrectionError('Enter a short reason for this glucose correction.');
      return;
    }

    const correctionItems = selectedPoints
      .filter((point): point is ChartPoint & { readingId: string } => Boolean(point.readingId))
      .map((point) => ({
        source: point.source,
        readingId: point.readingId,
        valueMmolL: previewCorrectionValues[point.readingId] ?? point.valueMmolL,
        reason: trimmedCorrectionReason
      }));

    if (correctionItems.length === 0) {
      setCorrectionError('No editable readings were selected.');
      return;
    }

    setIsSavingCorrection(true);
    setCorrectionError(null);

    try {
      const response = await fetch('/api/dashboard/glucose/corrections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: correctionItems
        })
      });

      const json = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(json.error?.message || 'Failed to update glucose correction');
      }

      setSelectedPoints([]);
      setPreviewCorrectionValues({});
      setCorrectionReasonInput('');
      await mutate();
    } catch (submitError) {
      setCorrectionError(
        submitError instanceof Error ? submitError.message : 'Failed to update glucose correction'
      );
    } finally {
      setIsSavingCorrection(false);
    }
  }

  async function removeCorrection() {
    if (!isOwner || !selectedPoints.length) {
      if (!isOwner) {
        setCorrectionError('Admin sign in is required to remove glucose corrections.');
      }
      return;
    }

    const correctionItems = selectedPoints
      .filter((point): point is ChartPoint & { readingId: string } => Boolean(point.readingId))
      .map((point) => ({
        source: point.source,
        readingId: point.readingId,
        valueMmolL: null,
        reason: null
      }));

    if (correctionItems.length === 0) {
      setCorrectionError('No corrected readings were selected.');
      return;
    }

    setIsSavingCorrection(true);
    setCorrectionError(null);

    try {
      const response = await fetch('/api/dashboard/glucose/corrections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: correctionItems
        })
      });

      const json = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(json.error?.message || 'Failed to remove glucose correction');
      }

      setSelectedPoints([]);
      setPreviewCorrectionValues({});
      setCorrectionReasonInput('');
      await mutate();
    } catch (submitError) {
      setCorrectionError(
        submitError instanceof Error ? submitError.message : 'Failed to remove glucose correction'
      );
    } finally {
      setIsSavingCorrection(false);
    }
  }

  async function saveNote() {
    if (!noteDraft || isNoteReadOnly) {
      if (!isOwner) {
        setNoteError('Admin sign in is required to save notes.');
      }
      return;
    }

    setHasAttemptedNoteSave(true);

    if (!noteValidation?.payload || !noteLastValidPreview) {
      setNoteError(null);
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);

    try {
      const response = await fetch(
        activeNoteId ? `/api/dashboard/glucose/notes/${activeNoteId}` : '/api/dashboard/glucose/notes',
        {
          method: activeNoteId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(noteValidation.payload)
        }
      );

      const json = await response.json() as { note?: TimelineNote; error?: { message?: string } };
      if (!response.ok || !json.note) {
        throw new Error(json.error?.message || 'Failed to save note');
      }

      const savedNote = json.note;
      const nextDraft = draftFromTimelineNote(savedNote);
      setActiveNoteId(savedNote.id);
      setNoteDraft(nextDraft);
      setNoteInitialDraft(nextDraft);
      setNoteLastValidPreview(savedNote);
      setNoteMode(isOwner ? 'edit' : 'read');
      setHasAttemptedNoteSave(false);
      setDeletedNoteIds((current) => current.filter((id) => id !== savedNote.id));
      await mutate(
        sourceData ? upsertTimelineNoteInHistoryResponse(sourceData, savedNote) : sourceDataResponse,
        { revalidate: true }
      );
    } catch (saveError) {
      setNoteError(saveError instanceof Error ? saveError.message : 'Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  }

  async function deleteNote() {
    if (!activeNoteId || !isOwner) {
      setNoteError('Admin sign in is required to delete notes.');
      return;
    }

    const deletingNoteId = activeNoteId;

    setIsSavingNote(true);
    setNoteError(null);

    try {
      const response = await fetch(`/api/dashboard/glucose/notes/${deletingNoteId}`, {
        method: 'DELETE'
      });
      const json = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(json.error?.message || 'Failed to delete note');
      }

      setDeletedNoteIds((current) => (
        current.includes(deletingNoteId) ? current : [...current, deletingNoteId]
      ));
      closeNoteEditor();
      await mutate(
        sourceData
          ? removeTimelineNoteFromHistoryResponse(sourceData, deletingNoteId, new Date().toISOString())
          : sourceDataResponse,
        { revalidate: true }
      );
    } catch (deleteError) {
      setNoteError(deleteError instanceof Error ? deleteError.message : 'Failed to delete note');
    } finally {
      setIsSavingNote(false);
      setIsConfirmingDelete(false);
    }
  }

  async function saveWorkout() {
    if (!workoutDraft || isWorkoutReadOnly) {
      if (!isOwner) {
        setWorkoutError('Admin sign in is required to save workouts.');
      }
      return;
    }

    if (!workoutValidation?.payload) {
      setWorkoutError(workoutValidation?.error ?? null);
      return;
    }

    setIsSavingWorkout(true);
    setWorkoutError(null);

    try {
      const response = await fetch(
        activeWorkoutId ? `/api/dashboard/glucose/workouts/${activeWorkoutId}` : '/api/dashboard/glucose/workouts',
        {
          method: activeWorkoutId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(workoutValidation.payload)
        }
      );

      const json = await response.json() as { workout?: WorkoutChartPoint; error?: { message?: string } };
      if (!response.ok || !json.workout) {
        throw new Error(json.error?.message || 'Failed to save workout');
      }

      const savedWorkout = json.workout;
      const nextDraft = draftFromWorkout(savedWorkout, ownerTimeZone);
      setActiveWorkoutId(savedWorkout.id);
      setWorkoutDraft(nextDraft);
      setWorkoutInitialDraft(nextDraft);
      setWorkoutLastValidPreview(savedWorkout);
      setWorkoutMode(isOwner ? 'edit' : 'read');
      await mutate(
        sourceData ? upsertWorkoutInHistoryResponse(sourceData, savedWorkout) : sourceDataResponse,
        { revalidate: true }
      );
    } catch (saveError) {
      setWorkoutError(saveError instanceof Error ? saveError.message : 'Failed to save workout');
    } finally {
      setIsSavingWorkout(false);
    }
  }

  async function deleteWorkout() {
    if (!activeWorkoutId || !isOwner || activeWorkout?.sourceSystem !== 'manual') {
      setWorkoutError('Only manual workouts can be deleted.');
      return;
    }

    const deletingWorkoutId = activeWorkoutId;
    setIsSavingWorkout(true);
    setWorkoutError(null);

    try {
      const response = await fetch(`/api/dashboard/glucose/workouts/${deletingWorkoutId}`, {
        method: 'DELETE'
      });
      const json = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(json.error?.message || 'Failed to delete workout');
      }

      closeWorkoutDialog();
      await mutate(
        sourceData ? removeWorkoutFromHistoryResponse(sourceData, deletingWorkoutId) : sourceDataResponse,
        { revalidate: true }
      );
    } catch (deleteError) {
      setWorkoutError(deleteError instanceof Error ? deleteError.message : 'Failed to delete workout');
    } finally {
      setIsSavingWorkout(false);
      setIsConfirmingWorkoutDelete(false);
    }
  }

  return (
    <div className="section-stack glucose-analysis-fullwidth">
      <DashboardTimeRangePicker
        selection={selection}
        currentWindow={targetWindow}
        timeZone={ownerTimeZone}
        toolbarControls={(
          <>
            <DashboardRefreshPicker
              value={autoRefresh}
              intervals={dashboardDefinition.spec.timeSettings.autoRefreshIntervals}
              currentWindow={targetWindow}
              onChange={setAutoRefresh}
              onRefresh={refreshDashboard}
            />
            <div id={STATISTICS_DASHBOARD_EDIT_CONTROLS_ID} />
          </>
        )}
        onChange={applyHistorySelection}
      />

      <DashboardViewPanelUrlStateBridge
        dashboardTitle={dashboardDefinition.spec.title}
        dashboardUid={dashboardDefinition.spec.uid}
        allowedPanelIds={Object.keys(dashboardDefinition.spec.elements)}
        panelIdAliases={getDashboardViewPanelAliases(dashboardDefinition)}
      >
        {({ viewedPanelId, onViewedPanelChange }) => (
      <DashboardDefinitionRenderer
        dashboard={dashboardDefinition}
        dashboardVersion={dashboardVersion}
        panelRegistry={statisticsPanelRegistry}
        isOwner={isOwner}
        viewedPanelId={viewedPanelId}
        onViewedPanelChange={onViewedPanelChange}
        settingsRegistry={settingsRegistry}
        timeSettings={dashboardTimeSettings}
        onDiscardTimeSettings={(timeSettings) => setAutoRefresh(timeSettings.autoRefresh)}
        timeInRangeDefaultLayout="statistics"
        editControlsPortalId={STATISTICS_DASHBOARD_EDIT_CONTROLS_ID}
        context={{
          renderAverageGlucosePanel: () => (
          <DashboardPanel
            title="Average Glucose"
            twStyles="flex flex-col [&>div:last-child]:flex-1 [&>div:last-child]:flex [&>div:last-child]:items-center [&>div:last-child]:justify-center"
            headerRight={
              updatesError
                ? <span className="ui_micro_label ui_mono_text text-base-error-dark">Stale</span>
                : undefined
            }
          >
          {hasData ? (
            <div className="flex items-end justify-center gap-6" style={{ opacity: isTransitioning ? 0.45 : 1, transition: 'opacity 200ms ease' }}>
              <div className="grid gap-4 justify-items-center pb-0.5">
                <span className={stats.min < 4 ? 'ui_mono_value_md' : 'ui_mono_value_md text-text-dim'} style={stats.min < 4 ? { color: lowColor } : undefined}>{stats.min.toFixed(1)}</span>
                <span className="ui_micro_label leading-none text-text-soft">Min</span>
              </div>
              <div className="grid gap-4 justify-items-center">
                <span className="ui_mono_value_display" style={{ color: avgColor }}>{stats.avg.toFixed(1)}</span>
                <span className="ui_micro_label leading-none text-text-soft">Avg</span>
              </div>
              <div className="grid gap-4 justify-items-center pb-0.5">
                <span className={stats.max > 10 ? 'ui_mono_value_md' : 'ui_mono_value_md text-text-dim'} style={stats.max > 10 ? { color: highColor } : undefined}>{stats.max.toFixed(1)}</span>
                <span className="ui_micro_label leading-none text-text-soft">Max</span>
              </div>
            </div>
          ) : (
            <div className="flex items-end justify-center gap-6">
              <div className="grid gap-4 justify-items-center pb-0.5">
                <div className="glucose-skeleton-bar" style={{ width: 32, height: 20 }} />
                <div className="glucose-skeleton-bar" style={{ width: 24, height: 10 }} />
              </div>
              <div className="grid gap-4 justify-items-center">
                <div className="glucose-skeleton-bar" style={{ width: 64, height: 48 }} />
                <div className="glucose-skeleton-bar" style={{ width: 24, height: 10 }} />
              </div>
              <div className="grid gap-4 justify-items-center pb-0.5">
                <div className="glucose-skeleton-bar" style={{ width: 32, height: 20 }} />
                <div className="glucose-skeleton-bar" style={{ width: 24, height: 10 }} />
              </div>
            </div>
          )}
          </DashboardPanel>
          ),
          renderTimeInRangePanel: () => (
          <TimeInRangePanel
            defaultLayout="statistics"
            stats={hasData ? stats : null}
            loading={isTransitioning}
            isDark={isDark}
          />
          ),
          renderWorkoutTypesPanel: () => (
          <WorkoutTypePanel
            workouts={data?.workoutItems ?? []}
            loading={isTransitioning}
          />
          ),
          renderGlucoseTimelinePanel: () => (
          <DashboardPanel
            title="Glucose Timeline"
            twStyles="overflow-visible"
            headerRight={
              <span className="ui_caption tracking-wide text-text-soft">⌘ + Scroll to zoom · Drag to pan</span>
            }
          >
        <div style={{ position: 'relative', minHeight: chartHeight, margin: '-1.5rem' }}>
          {isFirstLoad && (
            <div className="absolute inset-0 z-5 flex flex-col items-center justify-center gap-3">
              <div className="glucose-chart-skeleton" />
              <p className="body_text text-text-soft">Loading glucose data...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="absolute inset-0 z-5 flex flex-col items-center justify-center gap-3">
              <p className="body_text text-base-error-dark">{error.message}</p>
              <button
                type="button"
                onClick={() => mutate()}
                className="button-secondary"
                style={{ minHeight: '2.25rem' }}
              >
                Retry
              </button>
            </div>
          )}

          {!error && data && data.items.length === 0 && !isLoading && (
            <div className="body_text flex items-center justify-center text-text-soft" style={{ height: chartHeight }}>
              No glucose data available for this time range.
            </div>
          )}

          {hasData && (
            <div style={{ position: 'relative' }}>
              {workoutDraft ? (
                <DialogPanel title={activeWorkoutId ? (isWorkoutReadOnly ? 'Workout details' : 'Workout') : 'New workout'}>
                      <div className="flex min-h-[14rem] flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <label className="grid gap-1">
                            <span className="ui_micro_label text-text-soft">Start date</span>
                            <input
                              type="date"
                              value={workoutDraft.startDate}
                              disabled={isWorkoutReadOnly || isSavingWorkout}
                              onChange={(event) => setWorkoutDraft((current) => current ? { ...current, startDate: event.target.value } : current)}
                              className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="ui_micro_label text-text-soft">End date</span>
                            <input
                              type="date"
                              value={workoutDraft.endDate}
                              disabled={isWorkoutReadOnly || isSavingWorkout}
                              onChange={(event) => setWorkoutDraft((current) => current ? { ...current, endDate: event.target.value } : current)}
                              className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="grid gap-1">
                            <span className="ui_micro_label text-text-soft">Start time</span>
                            <input
                              aria-label="Start time"
                              type="time"
                              step={300}
                              value={workoutDraft.startTime}
                              disabled={isWorkoutReadOnly || isSavingWorkout}
                              onChange={(event) => setWorkoutDraft((current) => current ? { ...current, startTime: event.target.value } : current)}
                              className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="ui_micro_label text-text-soft">End time</span>
                            <input
                              aria-label="End time"
                              type="time"
                              step={300}
                              value={workoutDraft.endTime}
                              disabled={isWorkoutReadOnly || isSavingWorkout}
                              onChange={(event) => setWorkoutDraft((current) => current ? { ...current, endTime: event.target.value } : current)}
                              className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                            />
                          </label>
                        </div>
                        <label className="grid gap-1">
                          <span className="ui_micro_label text-text-soft">Workout type</span>
                          <select
                            aria-label="Workout type"
                            value={workoutDraft.workoutType}
                            disabled={isWorkoutReadOnly || isSavingWorkout}
                            onChange={(event) => setWorkoutDraft((current) => current ? { ...current, workoutType: event.target.value as WorkoutDraft['workoutType'] } : current)}
                            className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                          >
                            {NORMALIZED_WORKOUT_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1">
                          <span className="ui_micro_label text-text-soft">Display label</span>
                          <input
                            aria-label="Display label"
                            value={workoutDraft.displayName}
                            disabled={isWorkoutReadOnly || isSavingWorkout}
                            onChange={(event) => setWorkoutDraft((current) => current ? { ...current, displayName: event.target.value } : current)}
                            placeholder="Optional, for example Gym or Morning run"
                            className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                          />
                        </label>
                        {activePanelWorkout ? (
                          <div className="grid gap-1">
                            <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                              Source
                            </p>
                            <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                              {getWorkoutSourceLabel(activePanelWorkout.sourceSystem)}
                            </p>
                          </div>
                        ) : null}
                        <div className="mt-auto flex flex-wrap items-end gap-3">
                          <SecondaryButton
                            isActive={false}
                            onClick={() => {
                              void saveWorkout();
                            }}
                            disabled={isWorkoutReadOnly || isSavingWorkout || !workoutValidation?.payload || (!workoutDraftIsDirty && Boolean(activeWorkoutId))}
                          >
                            Save workout
                          </SecondaryButton>
                          <SecondaryButton
                            isActive={false}
                            onClick={() => {
                              closeWorkoutDialog();
                            }}
                            disabled={isSavingWorkout}
                          >
                            Close
                          </SecondaryButton>
                          {activeWorkoutId && activeWorkout?.sourceSystem === 'manual' ? (
                            isConfirmingWorkoutDelete ? (
                              <>
                                <SecondaryButton
                                  isActive={false}
                                  onClick={() => {
                                    void deleteWorkout();
                                  }}
                                  disabled={isSavingWorkout || !isOwner}
                                >
                                  Confirm delete
                                </SecondaryButton>
                                <SecondaryButton
                                  isActive={false}
                                  onClick={() => setIsConfirmingWorkoutDelete(false)}
                                  disabled={isSavingWorkout}
                                >
                                  Cancel delete
                                </SecondaryButton>
                              </>
                            ) : (
                              <SecondaryButton
                                isActive={false}
                                onClick={() => setIsConfirmingWorkoutDelete(true)}
                                disabled={isSavingWorkout || !isOwner}
                              >
                                Delete workout
                              </SecondaryButton>
                            )
                          ) : null}
                        </div>
                        {workoutValidation?.error ? (
                          <p className="body_text text-base-error-dark">{workoutValidation.error}</p>
                        ) : null}
                        {workoutError ? (
                          <p className="body_text text-base-error-dark">{workoutError}</p>
                        ) : isWorkoutReadOnly ? (
                          <p className="body_text text-text-soft">
                            Admin sign in is required to edit workouts.
                          </p>
                        ) : null}
                      </div>
                </DialogPanel>
              ) : activeWorkout ? (
                <DialogPanel title="Workout details" widthClassName="w-[min(28rem,calc(100%-2rem))]">
                      <div className="flex min-h-[12rem] flex-col gap-3">
                        <div className="grid gap-1">
                          <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                            Workout
                          </p>
                          <p className="body_text" style={{ margin: 0 }}>
                            {getWorkoutDisplayLabel(activeWorkout)}
                          </p>
                        </div>
                        <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                          <div className="grid gap-1">
                            <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                              Source
                            </p>
                            <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                              {getWorkoutSourceLabel(activeWorkout.sourceSystem)}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                              Duration
                            </p>
                            <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                              {formatWorkoutDuration(activeWorkout.startAt, activeWorkout.endAt)}
                            </p>
                          </div>
                        </div>
                        {activeWorkoutMetrics.length > 0 ? (
                          <div className="grid gap-1">
                            <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                              Metrics
                            </p>
                            <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                              {activeWorkoutMetrics.join(' · ')}
                            </p>
                          </div>
                        ) : null}
                        <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                          <div className="grid gap-1">
                            <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                              Date
                            </p>
                            <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                              {formatWorkoutDate(activeWorkout.startAt)}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                              Time
                            </p>
                            <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                              {formatWorkoutTimeRange(activeWorkout.startAt, activeWorkout.endAt)}
                            </p>
                          </div>
                        </div>
                        {activeWorkout.rawWorkoutType ? (
                          <div className="grid gap-1">
                            <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                              Imported type
                            </p>
                            <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                              {activeWorkout.rawWorkoutType}
                            </p>
                          </div>
                        ) : null}
                        <div className="mt-auto flex flex-wrap items-end gap-3">
                          <SecondaryButton
                            isActive={false}
                            onClick={() => {
                              closeWorkoutDialog();
                            }}
                          >
                            Close
                          </SecondaryButton>
                        </div>
                      </div>
                </DialogPanel>
              ) : null}
              {noteDraft ? (
                <DialogPanel title={activeNoteId ? 'Timeline note' : 'New timeline note'} overlayTestId="note-editor-overlay">
                      <div className="flex min-h-[14rem] flex-col gap-3">
                        <label className="grid gap-1">
                          <span className="ui_micro_label text-text-soft">Start date</span>
                          <input
                            type="date"
                            value={noteDraft.startDate}
                            disabled={isNoteReadOnly || isSavingNote}
                            onChange={(event) => setNoteDraft((current) => current ? { ...current, startDate: event.target.value } : current)}
                            className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="ui_micro_label text-text-soft">End date</span>
                          <input
                            type="date"
                            value={noteDraft.endDate}
                            disabled={isNoteReadOnly || isSavingNote}
                            onChange={(event) => setNoteDraft((current) => current ? { ...current, endDate: event.target.value } : current)}
                            className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                          />
                        </label>
                        {!isMultiDayNoteDraft ? (
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={noteDraft.allDay}
                              disabled={isNoteReadOnly || isSavingNote}
                              onChange={(event) => setNoteDraft((current) => current ? { ...current, allDay: event.target.checked } : current)}
                            />
                            <span className="body_text text-text-soft">All day</span>
                          </label>
                        ) : null}
                        {!noteDraft.allDay && !isMultiDayNoteDraft ? (
                          <div className="grid grid-cols-2 gap-3">
                            <label className="grid gap-1">
                              <span className="ui_micro_label text-text-soft">Start time</span>
                              <input
                                type="time"
                                step={1800}
                                value={noteDraft.startTime}
                                disabled={isNoteReadOnly || isSavingNote}
                                onChange={(event) => setNoteDraft((current) => current ? { ...current, startTime: event.target.value } : current)}
                                className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="ui_micro_label text-text-soft">End time</span>
                              <input
                                type="time"
                                step={1800}
                                value={noteDraft.endTime}
                                disabled={isNoteReadOnly || isSavingNote}
                                onChange={(event) => setNoteDraft((current) => current ? { ...current, endTime: event.target.value } : current)}
                                className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                              />
                            </label>
                          </div>
                        ) : null}
                        <label className="grid gap-1">
                          <span className="ui_micro_label text-text-soft">Note</span>
                          <textarea
                            ref={noteTextAreaRef}
                            value={noteDraft.text}
                            disabled={isNoteReadOnly || isSavingNote}
                            onChange={(event) => setNoteDraft((current) => current ? { ...current, text: event.target.value } : current)}
                            placeholder="Write a plain text note about what affected your glucose."
                            rows={5}
                            className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none"
                          />
                        </label>
                        {activeNoteId && activePanelNote ? (
                          <div className="grid gap-1">
                            <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                              Audit
                            </p>
                            <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                              Created by {activePanelNote.createdBy}
                            </p>
                            {wasTimelineNoteEdited(activePanelNote) ? (
                              <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                                Updated by {activePanelNote.updatedBy}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-auto flex flex-wrap items-end gap-3">
                          <SecondaryButton
                            isActive={false}
                            onClick={() => {
                              void saveNote();
                            }}
                            disabled={isNoteReadOnly || isSavingNote || !noteDraftIsDirty}
                          >
                            Save note
                          </SecondaryButton>
                          <SecondaryButton
                            isActive={false}
                            onClick={() => {
                              closeNoteEditor();
                            }}
                            disabled={isSavingNote}
                          >
                            Close
                          </SecondaryButton>
                          {activeNoteId ? (
                            isConfirmingDelete ? (
                              <>
                                <SecondaryButton
                                  isActive={false}
                                  onClick={() => {
                                    void deleteNote();
                                  }}
                                  disabled={isSavingNote || !isOwner}
                                >
                                  Confirm delete
                                </SecondaryButton>
                                <SecondaryButton
                                  isActive={false}
                                  onClick={() => setIsConfirmingDelete(false)}
                                  disabled={isSavingNote}
                                >
                                  Cancel delete
                                </SecondaryButton>
                              </>
                            ) : (
                              <SecondaryButton
                                isActive={false}
                                onClick={() => setIsConfirmingDelete(true)}
                                disabled={isSavingNote || !isOwner}
                              >
                                Delete note
                              </SecondaryButton>
                            )
                          ) : null}
                        </div>
                        {hasAttemptedNoteSave && noteValidation?.error ? (
                          <p className="body_text text-base-error-dark">{noteValidation.error}</p>
                        ) : null}
                        {noteError ? (
                          <p className="body_text text-base-error-dark">{noteError}</p>
                        ) : !isOwner ? (
                          <p className="body_text text-text-soft">
                            Admin sign in is required to create, edit, or delete notes.
                          </p>
                        ) : null}
                      </div>
                </DialogPanel>
              ) : null}
              {selectedPoints.length > 0 ? (
                <div className="absolute right-4 top-4 z-10 w-[min(30rem,calc(100%-2rem))]">
                  <FloatingPanel title="Active readings">
                    <div className="flex min-h-[10.5rem] flex-col gap-3">
                      <p className="body_text text-text-soft">
                        {canRemoveCorrection
                          ? selectedPoints.length === 1
                            ? '1 corrected reading selected. Remove correction to restore the original value.'
                            : `${selectedPoints.length} corrected readings selected. Remove correction to restore the original values.`
                          : hasPreviewCorrection
                          ? selectedPoints.length === 1
                            ? '1 reading is being adjusted.'
                            : `${selectedPoints.length} readings are being adjusted.`
                          : selectedPoints.length === 1
                            ? '1 reading selected. Click more readings to add them to this correction.'
                            : `${selectedPoints.length} readings selected. Click more readings to keep building this correction.`}
                      </p>
                      {canRemoveCorrection ? null : (
                        <label className="grid gap-1">
                          <span className="ui_micro_label text-text-soft">
                            Reason <span className="text-error">*</span>
                          </span>
                          <input
                            type="text"
                            value={correctionReasonInput}
                            onChange={(event) => setCorrectionReasonInput(event.target.value)}
                            placeholder="Short note about why this reading was corrected"
                            maxLength={240}
                            required
                            className="ui_input_text w-full rounded-[4px] border border-border bg-surface-muted px-3 py-2 text-text outline-none placeholder:text-text-soft placeholder:opacity-60 focus:border-border-strong"
                            aria-label="Reason for glucose correction"
                          />
                        </label>
                      )}
                      <div className="mt-auto flex flex-wrap items-end gap-3">
                        {canRemoveCorrection ? (
                          <SecondaryButton
                            isActive={false}
                            onClick={() => {
                              void removeCorrection();
                            }}
                            disabled={isSavingCorrection || !isOwner}
                          >
                            Remove correction
                          </SecondaryButton>
                        ) : (
                          <SecondaryButton
                            isActive={false}
                            onClick={() => {
                              void submitCorrection();
                            }}
                            disabled={isSavingCorrection || isCorrectionReasonMissing || !isOwner || !hasPreviewCorrection}
                          >
                            Apply preview
                          </SecondaryButton>
                        )}
                        <SecondaryButton
                          isActive={false}
                          onClick={() => {
                            setSelectedPoints([]);
                            setPreviewCorrectionValues({});
                            setCorrectionReasonInput('');
                            setCorrectionError(null);
                          }}
                          disabled={isSavingCorrection}
                        >
                          Cancel
                        </SecondaryButton>
                      </div>
                      {correctionError ? (
                        <p className="body_text text-base-error-dark">{correctionError}</p>
                      ) : !isOwner ? (
                        <p className="body_text text-text-soft">
                          {canRemoveCorrection
                            ? 'Admin sign in is required to remove glucose corrections.'
                            : 'Preview is available to everyone. Admin sign in is required to apply corrections.'}
                        </p>
                      ) : null}
                    </div>
                  </FloatingPanel>
                </div>
              ) : null}
              {isTransitioning && (
                <div className="absolute inset-0 z-5 flex items-center justify-center">
                  <div className="glucose-spinner" />
                </div>
              )}
              <div style={{ opacity: isTransitioning ? 0.35 : 1, transition: 'opacity 200ms ease' }}>
                <GlucoseTimelineChart
                  data={data.items}
                  basalData={data.basalItems}
                  eventData={data.eventItems}
                  stepData={data.stepItems}
                  workoutData={data.workoutItems ?? []}
                  noteData={displayData?.noteItems ?? []}
                  height={chartHeight}
                  editable
                  selectedReadingIds={selectedReadingIds}
                  selectedWorkoutId={activeWorkoutId}
                  selectedNoteId={activeNoteId}
                  previewReadingValues={previewCorrectionValues}
                  onPointSelect={handlePointSelect}
                  onCorrectionPreviewChange={handleCorrectionPreviewChange}
                  onWorkoutSelect={handleWorkoutSelect}
                  onWorkoutAddRequest={isOwner ? handleWorkoutAddRequest : undefined}
                  onNoteSelect={handleNoteSelect}
                  onNoteAddRequest={handleNoteAddRequest}
                />
              </div>
            </div>
          )}
        </div>
          </DashboardPanel>
          ),
          renderAgpPanel: () => (
          <DashboardPanel title="Ambulatory Glucose Profile">
        <div style={{ margin: '-1.5rem' }}>
          {hasData ? (
            <div style={{ position: 'relative' }}>
              {isTransitioning && (
                <div className="absolute inset-0 z-5 flex items-center justify-center">
                  <div className="glucose-spinner" />
                </div>
              )}
              <div style={{ opacity: isTransitioning ? 0.35 : 1, transition: 'opacity 200ms ease' }}>
                <GlucoseAgpWithPanelSettings data={data.items} height={400} />
              </div>
            </div>
          ) : (
            <div className="body_text flex items-center justify-center text-text-soft" style={{ height: 400 }}>
              {isFirstLoad ? '' : 'No data available.'}
            </div>
          )}
        </div>
          </DashboardPanel>
          ),
        }}
      />
        )}
      </DashboardViewPanelUrlStateBridge>
    </div>
  );
}
