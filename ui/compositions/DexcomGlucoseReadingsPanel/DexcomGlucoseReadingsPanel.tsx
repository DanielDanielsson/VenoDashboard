'use client';

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import useSWR from 'swr';
import { Button } from '@ui/base/Button';
import { DashboardPanelHeaderButton } from '@ui/components/DashboardPanelHeaderButton';
import { UplotGlucoseChart } from '@ui/components/UplotGlucoseChart';
import {
  useDashboardPanelSettings,
  type DashboardPanelSettingsRegistration,
} from '@ui/compositions/DashboardGrid';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { NumberInput } from '@ui/components/NumberInput';
import { SegmentedControl } from '@ui/components/SegmentedControl';
import { SegmentedSelector } from '@ui/base/SegmentedSelector';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import { serializeTimeRangeClipboardValue } from '@/lib/glucose/time-range-clipboard';
import type { ChartPoint } from '@/lib/glucose/types';
import { GLUCOSE_COLOR_MODES, type GlucoseColorMode } from '@/lib/glucose/tints';
import { type GlucoseUnit } from '@/lib/glucose/units';

type LegacyDexcomGlucoseReadingsPanelColorMode = 'single' | 'threshold';
type DexcomGlucoseReadingsPanelUnitSetting = GlucoseUnit | 'global';

export interface DexcomGlucoseReadingsPanelSettings {
  colorMode: GlucoseColorMode | LegacyDexcomGlucoseReadingsPanelColorMode;
  yAxisMax: number;
  unit: DexcomGlucoseReadingsPanelUnitSetting;
}

export interface DexcomGlucoseReadingsPanelProps {
  panelId?: string;
  isOwner?: boolean;
  refreshRevision?: number;
  timeWindow: {
    from: string;
    to: string;
  } | null;
  timeWindowCacheKey?: string | null;
  settings?: Partial<DexcomGlucoseReadingsPanelSettings>;
  globalGlucoseUnit?: GlucoseUnit;
}

interface GlucoseReadingsSeriesResponse {
  items: Array<{
    readingId?: string;
    timestamp: string;
    valueMmolL: number;
    originalValueMmolL?: number | null;
    isCorrected?: boolean;
    correctionReason?: string | null;
    source: 'official' | 'share';
  }>;
  meta?: {
    resolution?: {
      mode?: 'raw' | 'reduced';
      intervalMs?: number;
      maxDataPoints?: number;
      returnedPoints?: number;
    };
    capabilities?: {
      correctionsAllowed?: boolean;
    };
  };
}

interface MaxDataPointsState {
  from: string;
  to: string;
  value: number;
}

const DEFAULT_SETTINGS: DexcomGlucoseReadingsPanelSettings = {
  colorMode: 'standard',
  yAxisMax: 18,
  unit: 'global',
};

const DEFAULT_PANEL_ID = 'panel-dexcom-glucose-readings';
const DEFAULT_CHART_HEIGHT = 320;
const MIN_CHART_HEIGHT = 256;
const WIDTH_REFETCH_DEBOUNCE_MS = 150;
const WIDTH_REFETCH_GROWTH_THRESHOLD_PX = 16;
const CGM_READING_INTERVAL_MS = 5 * 60 * 1000;
const RAW_READING_WINDOW_PADDING_POINTS = 2;
const MAX_RAW_READING_POINTS = 10_000;
const DEXCOM_GLUCOSE_READINGS_UNIT_OPTIONS = [
  { value: 'global', label: 'Use global setting' },
  { value: 'mmol/L', label: 'mmol/l' },
  { value: 'mg/dL', label: 'mg/dl' },
] as const satisfies readonly [
  { value: DexcomGlucoseReadingsPanelUnitSetting; label: string },
  { value: DexcomGlucoseReadingsPanelUnitSetting; label: string },
  ...Array<{ value: DexcomGlucoseReadingsPanelUnitSetting; label: string }>,
];

const buildSeriesUrl = (
  timeWindow: NonNullable<DexcomGlucoseReadingsPanelProps['timeWindow']>,
  maxDataPoints: number,
): string => {
  const params = new URLSearchParams();
  params.set('from', timeWindow.from);
  params.set('to', timeWindow.to);
  params.set('maxDataPoints', String(maxDataPoints));
  return `/api/dashboard/glucose/readings-series?${params.toString()}`;
};

const buildSeriesCacheKey = ({
  maxDataPoints,
  timeWindow,
  timeWindowCacheKey,
  zoomWindow,
}: {
  maxDataPoints: number;
  timeWindow: NonNullable<DexcomGlucoseReadingsPanelProps['timeWindow']>;
  timeWindowCacheKey?: string | null;
  zoomWindow: DexcomGlucoseReadingsPanelProps['timeWindow'];
}): string => {
  const windowKey = zoomWindow
    ? `window:${zoomWindow.from}:${zoomWindow.to}`
    : timeWindowCacheKey ?? `window:${timeWindow.from}:${timeWindow.to}`;

  return `readings-series:${windowKey}:maxDataPoints:${maxDataPoints}`;
};

const fetchReadingsSeries = async (url: string): Promise<GlucoseReadingsSeriesResponse> => {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json() as GlucoseReadingsSeriesResponse | { error?: { message?: string } };
  if (!response.ok) {
    throw new Error('error' in payload ? payload.error?.message : 'Failed to load glucose readings');
  }

  return payload as GlucoseReadingsSeriesResponse;
};

const readPanelWidth = (element: HTMLDivElement | null): number => {
  const width = element?.clientWidth ?? 0;
  return Math.max(1, Math.floor(width || 640));
};

export const resolveDexcomGlucoseReadingsMaxDataPoints = (
  timeWindow: NonNullable<DexcomGlucoseReadingsPanelProps['timeWindow']>,
  panelWidth: number,
): number => {
  const fromMs = new Date(timeWindow.from).getTime();
  const toMs = new Date(timeWindow.to).getTime();
  const widthBudget = Math.max(1, Math.floor(panelWidth));

  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return widthBudget;
  }

  const cadenceBudget = Math.ceil((toMs - fromMs) / CGM_READING_INTERVAL_MS)
    + RAW_READING_WINDOW_PADDING_POINTS;

  return Math.max(widthBudget, Math.min(cadenceBudget, MAX_RAW_READING_POINTS));
};

const resolveColorMode = (
  colorMode: DexcomGlucoseReadingsPanelSettings['colorMode'],
): GlucoseColorMode => {
  return colorMode === 'gradient' ? 'gradient' : 'standard';
};

export const resolveDexcomGlucoseReadingsPanelUnit = (
  unit: DexcomGlucoseReadingsPanelUnitSetting | undefined,
  globalGlucoseUnit: GlucoseUnit,
): GlucoseUnit => {
  return unit === 'mg/dL' || unit === 'mmol/L' ? unit : globalGlucoseUnit;
};

export const DexcomGlucoseReadingsPanel = ({
  panelId = DEFAULT_PANEL_ID,
  isOwner = false,
  refreshRevision = 0,
  timeWindow,
  timeWindowCacheKey,
  settings,
  globalGlucoseUnit = 'mmol/L',
}: DexcomGlucoseReadingsPanelProps): ReactElement => {
  const [persistedSettings] = useDashboardPanelSettings(panelId, DEFAULT_SETTINGS);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartFrameRef = useRef<HTMLDivElement | null>(null);
  const [selectedReading, setSelectedReading] = useState<GlucoseReadingsSeriesResponse['items'][number] | null>(null);
  const [correctionValueInput, setCorrectionValueInput] = useState('');
  const [correctionReasonInput, setCorrectionReasonInput] = useState('');
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [chartHeight, setChartHeight] = useState(DEFAULT_CHART_HEIGHT);
  const [zoomWindow, setZoomWindow] = useState<{ from: string; to: string } | null>(null);
  const [maxDataPointsState, setMaxDataPointsState] = useState<MaxDataPointsState | null>(null);
  const { notifyError, notifySuccess } = useNotifications();
  const widthRefetchTimerRef = useRef<number | null>(null);
  const lastRefreshRevisionRef = useRef(refreshRevision);
  const mergedSettings = {
    ...DEFAULT_SETTINGS,
    ...persistedSettings,
    ...(settings ?? {}),
  };
  const chartGlucoseUnit = resolveDexcomGlucoseReadingsPanelUnit(mergedSettings.unit, globalGlucoseUnit);
  const effectiveWindow = zoomWindow ?? timeWindow;
  const effectiveFrom = effectiveWindow?.from ?? null;
  const effectiveTo = effectiveWindow?.to ?? null;
  const maxDataPoints = effectiveWindow
    && maxDataPointsState?.from === effectiveWindow.from
    && maxDataPointsState.to === effectiveWindow.to
    ? maxDataPointsState.value
    : null;
  const readingsSeriesUrl = effectiveWindow && maxDataPoints
    ? buildSeriesUrl(effectiveWindow, maxDataPoints)
    : null;
  const readingsSeriesKey = effectiveWindow && maxDataPoints
    ? buildSeriesCacheKey({
        maxDataPoints,
        timeWindow: effectiveWindow,
        timeWindowCacheKey,
        zoomWindow,
      })
    : null;
  const {
    data,
    error,
    isValidating,
    mutate,
  } = useSWR<GlucoseReadingsSeriesResponse>(
    readingsSeriesKey,
    () => readingsSeriesUrl
      ? fetchReadingsSeries(readingsSeriesUrl)
      : Promise.reject(new Error('No glucose readings URL')),
    {
      dedupingInterval: 60_000,
      keepPreviousData: true,
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );
  const errorMessage = error instanceof Error ? error.message : null;
  const isUpdating = Boolean(data && isValidating);
  const correctionsAllowed = isOwner && data?.meta?.capabilities?.correctionsAllowed === true;
  const chartRenderMode = data?.meta?.resolution?.mode === 'reduced' ? 'line' : 'points';

  useEffect(() => {
    setZoomWindow(null);
  }, [timeWindow?.from, timeWindow?.to]);

  const updateMaxDataPoints = useCallback(() => {
    if (!effectiveWindow) {
      return;
    }

    const nextMaxDataPoints = resolveDexcomGlucoseReadingsMaxDataPoints(
      effectiveWindow,
      readPanelWidth(containerRef.current),
    );
    setMaxDataPointsState((currentMaxDataPoints) => (
      currentMaxDataPoints?.from === effectiveWindow.from
      && currentMaxDataPoints.to === effectiveWindow.to
      && currentMaxDataPoints.value === nextMaxDataPoints
        ? currentMaxDataPoints
        : {
            from: effectiveWindow.from,
            to: effectiveWindow.to,
            value: nextMaxDataPoints,
          }
    ));
  }, [effectiveWindow]);

  useEffect(() => {
    if (!timeWindow) {
      return;
    }

    updateMaxDataPoints();
  }, [timeWindow, zoomWindow, updateMaxDataPoints]);

  useEffect(() => {
    setSelectedReading(null);
    setCorrectionError(null);
  }, [effectiveFrom, effectiveTo]);

  useEffect(() => {
    if (lastRefreshRevisionRef.current === refreshRevision) {
      return;
    }

    lastRefreshRevisionRef.current = refreshRevision;
    if (readingsSeriesUrl) {
      void mutate();
    }
  }, [mutate, readingsSeriesUrl, refreshRevision]);

  useEffect(() => {
    const element = chartFrameRef.current;
    if (!element) {
      return undefined;
    }

    const updateChartHeight = () => {
      const nextHeight = Math.floor(element.clientHeight);
      if (nextHeight > 0) {
        setChartHeight(Math.max(MIN_CHART_HEIGHT, nextHeight));
      }
    };

    updateChartHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateChartHeight);
      return () => window.removeEventListener('resize', updateChartHeight);
    }

    const observer = new ResizeObserver(updateChartHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data, selectedReading]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !timeWindow || !effectiveWindow) {
      return undefined;
    }

    const clearPendingRefetch = () => {
      if (widthRefetchTimerRef.current !== null) {
        window.clearTimeout(widthRefetchTimerRef.current);
        widthRefetchTimerRef.current = null;
      }
    };

    const scheduleWiderRefetch = () => {
      const nextMaxDataPoints = resolveDexcomGlucoseReadingsMaxDataPoints(
        effectiveWindow,
        readPanelWidth(element),
      );
      const lastRequestedMaxDataPoints = maxDataPoints ?? 0;

      if (lastRequestedMaxDataPoints < 1) {
        return;
      }

      if (nextMaxDataPoints <= lastRequestedMaxDataPoints + WIDTH_REFETCH_GROWTH_THRESHOLD_PX) {
        return;
      }

      if (widthRefetchTimerRef.current !== null) {
        window.clearTimeout(widthRefetchTimerRef.current);
      }

      widthRefetchTimerRef.current = window.setTimeout(() => {
        widthRefetchTimerRef.current = null;

        setMaxDataPointsState((currentMaxDataPoints) => (
          currentMaxDataPoints?.from === effectiveWindow.from
          && currentMaxDataPoints.to === effectiveWindow.to
          && currentMaxDataPoints.value === nextMaxDataPoints
            ? currentMaxDataPoints
            : {
                from: effectiveWindow.from,
                to: effectiveWindow.to,
                value: nextMaxDataPoints,
              }
        ));
      }, WIDTH_REFETCH_DEBOUNCE_MS);
    };

    window.addEventListener('resize', scheduleWiderRefetch);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleWiderRefetch);
    observer?.observe(element);

    return () => {
      window.removeEventListener('resize', scheduleWiderRefetch);
      observer?.disconnect();
      clearPendingRefetch();
    };
  }, [effectiveWindow, maxDataPoints, timeWindow]);

  const handlePointSelect = (reading: ChartPoint) => {
    if (!correctionsAllowed || !reading.readingId) {
      return;
    }

    setSelectedReading(reading);
    setCorrectionValueInput(String(reading.valueMmolL));
    setCorrectionReasonInput(reading.correctionReason ?? '');
    setCorrectionError(null);
  };

  const selectedOriginalValue = selectedReading?.originalValueMmolL ?? selectedReading?.valueMmolL ?? null;

  const submitCorrection = async () => {
    if (!selectedReading?.readingId) {
      return;
    }

    const parsedValue = Number(correctionValueInput);
    if (!Number.isFinite(parsedValue)) {
      setCorrectionError('Enter a valid glucose value.');
      return;
    }

    setIsSavingCorrection(true);
    setCorrectionError(null);

    try {
      const response = await fetch('/api/dashboard/glucose/corrections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              source: selectedReading.source,
              readingId: selectedReading.readingId,
              valueMmolL: parsedValue,
              reason: correctionReasonInput.trim() || null,
            },
          ],
        }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message || 'Failed to update glucose correction');
      }

      setSelectedReading(null);
      setCorrectionValueInput('');
      setCorrectionReasonInput('');
      await mutate();
    } catch (submitError) {
      setCorrectionError(submitError instanceof Error ? submitError.message : 'Failed to update glucose correction');
    } finally {
      setIsSavingCorrection(false);
    }
  };

  const clearCorrection = async () => {
    if (!selectedReading?.readingId) {
      return;
    }

    setIsSavingCorrection(true);
    setCorrectionError(null);

    try {
      const response = await fetch('/api/dashboard/glucose/corrections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              source: selectedReading.source,
              readingId: selectedReading.readingId,
              valueMmolL: null,
              reason: null,
            },
          ],
        }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message || 'Failed to clear glucose correction');
      }

      setSelectedReading(null);
      setCorrectionValueInput('');
      setCorrectionReasonInput('');
      await mutate();
    } catch (submitError) {
      setCorrectionError(submitError instanceof Error ? submitError.message : 'Failed to clear glucose correction');
    } finally {
      setIsSavingCorrection(false);
    }
  };

  const copyZoomTimeRange = useCallback(async () => {
    if (!zoomWindow) {
      return;
    }

    try {
      await navigator.clipboard.writeText(serializeTimeRangeClipboardValue(zoomWindow));
      notifySuccess('Time range copied');
    } catch {
      notifyError('Time range could not be copied');
    }
  }, [notifyError, notifySuccess, zoomWindow]);

  return (
    <DashboardPanel
      title="Glucose Readings"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      twStyles="flex h-full flex-col"
      headerRight={zoomWindow ? (
        <div className="flex items-center gap-2">
          <DashboardPanelHeaderButton
            onClick={copyZoomTimeRange}
          >
            Copy time range
          </DashboardPanelHeaderButton>
          <DashboardPanelHeaderButton
            onClick={() => setZoomWindow(null)}
          >
            Reset zoom
          </DashboardPanelHeaderButton>
        </div>
      ) : null}
    >
      <div ref={containerRef} className="flex min-h-[18rem] min-w-0 flex-1 flex-col">
        {!timeWindow ? (
          <p className="body_text text-text-soft">No time range selected.</p>
        ) : errorMessage ? (
          <p className="body_text text-base-error-dark">{errorMessage}</p>
        ) : data && effectiveWindow ? (
          <>
            <div ref={chartFrameRef} className="relative min-h-[16rem] min-w-0 flex-1">
              <div className="transition-opacity" style={{ opacity: isUpdating ? 0.45 : 1 }}>
                <UplotGlucoseChart
                  ariaLabel="Dexcom G7 glucose readings chart"
                  data={data.items}
                  timeWindow={effectiveWindow}
                  height={chartHeight}
                  colorMode={resolveColorMode(mergedSettings.colorMode)}
                  glucoseUnit={chartGlucoseUnit}
                  yMax={mergedSettings.yAxisMax}
                  editable={correctionsAllowed}
                  renderMode={chartRenderMode}
                  selectedReadingIds={selectedReading?.readingId ? [selectedReading.readingId] : []}
                  onPointSelect={handlePointSelect}
                  onZoomWindowChange={setZoomWindow}
                />
              </div>
              {isUpdating ? (
                <div className="ui_caption pointer-events-none absolute right-3 top-3 rounded-[4px] border border-dashboard-panel-border bg-dashboard-panel-bg px-2 py-1 text-text-soft">
                  Updating readings...
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="body_text flex-1 text-text-soft">Loading glucose readings...</div>
        )}
        {selectedReading ? (
          <div className="mt-4 grid gap-3 border-t border-dashboard-panel-border pt-4">
            <h3 className="section_title text-dashboard-panel-title">Correct reading</h3>
            <div className="body_text flex flex-wrap gap-3 text-text-soft">
              <span>Original {selectedOriginalValue} mmol/L</span>
              <span>Current {selectedReading.valueMmolL} mmol/L</span>
            </div>
            <NumberInput
              label="Corrected"
              value={correctionValueInput}
              min={1}
              step={0.1}
              onChange={setCorrectionValueInput}
              ariaLabel="Corrected glucose value in mmol/L"
            />
            <label className="grid gap-1 ui_micro_label text-text-soft">
              <span>Reason</span>
              <input
                aria-label="Correction reason"
                value={correctionReasonInput}
                onChange={(event) => setCorrectionReasonInput(event.target.value)}
                className="body_text rounded-[4px] border border-number-input-border bg-number-input-bg px-2 py-1 text-number-input-text focus:border-number-input-focus-border focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={submitCorrection}
                disabled={isSavingCorrection}
                twStyles="body_text rounded-[4px] bg-text-primary px-3 py-1.5 text-bg-primary"
              >
                Save correction
              </Button>
              {selectedReading.isCorrected ? (
                <Button
                  onClick={clearCorrection}
                  disabled={isSavingCorrection}
                  twStyles="body_text rounded-[4px] border border-number-input-border px-3 py-1.5 text-text-primary"
                >
                  Clear correction
                </Button>
              ) : null}
            </div>
            {correctionError ? (
              <p className="body_text text-base-error-dark">{correctionError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </DashboardPanel>
  );
};

export const createDexcomGlucoseReadingsPanelSettingsRegistration = ():
  DashboardPanelSettingsRegistration => ({
    defaultSettings: DEFAULT_SETTINGS,
    render: ({ settings, updateSettings }) => {
      const typedSettings = settings as DexcomGlucoseReadingsPanelSettings;
      const updateTypedSettings = updateSettings as (
        updater: (current: DexcomGlucoseReadingsPanelSettings) => DexcomGlucoseReadingsPanelSettings
      ) => void;

      return (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <span className="ui_micro_label text-text-soft">Unit</span>
            <SegmentedSelector
              ariaLabel="Glucose readings chart unit"
              value={typedSettings.unit ?? 'global'}
              options={DEXCOM_GLUCOSE_READINGS_UNIT_OPTIONS}
              onChange={(unit) => updateTypedSettings((current) => ({
                ...current,
                unit,
              }))}
            />
          </div>
          <div className="grid gap-2">
            <span className="ui_micro_label text-text-soft">Color</span>
            <SegmentedControl
              value={resolveColorMode(typedSettings.colorMode)}
              options={GLUCOSE_COLOR_MODES}
              onChange={(value) => updateTypedSettings((current) => ({
                ...current,
                colorMode: value,
              }))}
            />
          </div>
          <NumberInput
            label="Y axis max"
            value={String(typedSettings.yAxisMax)}
            min={12}
            step={1}
            onChange={(value) => {
              const parsed = Number(value);
              updateTypedSettings((current) => ({
                ...current,
                yAxisMax: Number.isFinite(parsed) ? parsed : current.yAxisMax,
              }));
            }}
            ariaLabel="Glucose readings chart top value in mmol/L"
          />
        </div>
      );
    },
  });
