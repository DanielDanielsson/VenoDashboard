'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { GlucoseChart } from '@ui/components/GlucoseChart/GlucoseChart';
import { GlucoseAgpChart } from '@ui/components/GlucoseAgpChart/GlucoseAgpChart';
import { GlucoseDateRangePicker } from '@ui/components/GlucoseDateRangePicker/GlucoseDateRangePicker';
import { GlucoseStatRing } from '@ui/components/GlucoseStatRing/GlucoseStatRing';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { NumberInput } from '@ui/components/NumberInput';
import { SegmentedControl } from '@ui/components/SegmentedControl';
import { GLUCOSE_COLOR_MODES, type GlucoseColorMode } from '@/lib/glucose/tints';
import {
  buildPresetWindow,
  getHistoryCustomKey,
  getHistoryRangeKey,
  pickBestLoadedSourceKey,
  sliceHistoryResponseToWindow,
  type HistorySelection,
  type HistoryWindow
} from '@/lib/glucose/history-cache';
import { computeGlucoseStats } from '@/lib/glucose/metrics';
import { GLUCOSE_TIME_RANGES } from '@/lib/glucose/time-ranges';
import { SecondaryButton } from '@ui/components/SecondaryButton';
import type { ChartPoint, GlucoseApiResponse, GlucoseUpdatesResponse } from '@/lib/glucose/types';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const json = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(json.error?.message || 'Request failed');
  }

  return json;
}

const GLUCOSE_CHART_COLOR_MODE_STORAGE_KEY = 'pulse-glucose-chart-color-mode';
const DEFAULT_GLUCOSE_CHART_COLOR_MODE: GlucoseColorMode = 'threeColors';

function getUpdatesKey(timestamp: string): string {
  return `/api/dashboard/glucose/updates?since=${encodeURIComponent(timestamp)}`;
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

function getStoredChartColorMode(): GlucoseColorMode {
  try {
    const stored = globalThis.localStorage?.getItem(GLUCOSE_CHART_COLOR_MODE_STORAGE_KEY);
    return stored === 'threeColors' || stored === 'gradient' ? stored : DEFAULT_GLUCOSE_CHART_COLOR_MODE;
  } catch {
    return DEFAULT_GLUCOSE_CHART_COLOR_MODE;
  }
}

function getInitialIsDark(): boolean {
  try {
    return document.documentElement.classList.contains('theme-dark');
  } catch {
    return true;
  }
}

function roundCorrectionValue(value: number): number {
  return Number(value.toFixed(1));
}

function getChartHeight(data: Pick<GlucoseApiResponse, 'basalItems' | 'eventItems' | 'stepItems'> | undefined): number {
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

  return totalHeight;
}

export function GlucoseAnalysisView({ isOwner = false }: { isOwner?: boolean }) {
  const [selection, setSelection] = useState<HistorySelection>({
    kind: 'preset',
    range: '3d'
  });
  const [isDark, setIsDark] = useState(getInitialIsDark);

  useEffect(() => {
    const read = () => document.documentElement.classList.contains('theme-dark');
    const handleChange = () => setIsDark(read());
    window.addEventListener('pulse-theme-change', handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener('pulse-theme-change', handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);
  const [chartYMaxInput, setChartYMaxInput] = useState('25');
  const [chartColorMode, setChartColorMode] = useState<GlucoseColorMode>(DEFAULT_GLUCOSE_CHART_COLOR_MODE);
  const [selectedPoints, setSelectedPoints] = useState<ChartPoint[]>([]);
  const [previewCorrectionValues, setPreviewCorrectionValues] = useState<Record<string, number>>({});
  const [correctionReasonInput, setCorrectionReasonInput] = useState('');
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const isApplyingUpdatesRef = useRef(false);
  const { cache, mutate: globalMutate } = useSWRConfig();

  const loadedSourceKey = pickBestLoadedSourceKey(cache, selection);
  const requestKey =
    selection.kind === 'preset'
      ? getHistoryRangeKey(selection.range)
      : getHistoryCustomKey(selection.window);
  const sourceKey = loadedSourceKey ?? requestKey;

  const {
    data: sourceData,
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

  const targetWindow = getSelectionTargetWindow(selection, sourceData);
  const data = sourceData && targetWindow
    ? sliceHistoryResponseToWindow(sourceData, targetWindow)
    : sourceData;
  const chartHeight = getChartHeight(data);

  const isTransitioning = isValidating || isLoading;
  const isFirstLoad = !data && isLoading;

  const displayedLatestTimestamp = selection.kind === 'preset' ? data?.latest?.timestamp ?? null : null;
  const {
    data: updates,
    error: updatesError
  } = useSWR<GlucoseUpdatesResponse>(
    displayedLatestTimestamp ? getUpdatesKey(displayedLatestTimestamp) : null,
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

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setChartColorMode(getStoredChartColorMode());
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const stats = computeGlucoseStats(data?.items ?? []);
  const newUpdatesCount = updates?.meta.newCount ?? 0;
  const parsedChartYMax = Number(chartYMaxInput);
  const chartYMax = Number.isFinite(parsedChartYMax) ? Math.max(12, parsedChartYMax) : 25;

  const activePreset = selection.kind === 'preset' ? selection.range : null;
  const customValue = selection.kind === 'custom' ? selection.window : null;

  function updateChartColorMode(mode: GlucoseColorMode) {
    setChartColorMode(mode);

    try {
      localStorage.setItem(GLUCOSE_CHART_COLOR_MODE_STORAGE_KEY, mode);
    } catch {
      return;
    }
  }

  useEffect(() => {
    if (selection.kind !== 'preset') {
      return;
    }

    if (!displayedLatestTimestamp || newUpdatesCount <= 0 || isApplyingUpdatesRef.current || isValidating) {
      return;
    }

    isApplyingUpdatesRef.current = true;
    void globalMutate(sourceKey).finally(() => {
      isApplyingUpdatesRef.current = false;
    });
  }, [
    displayedLatestTimestamp,
    globalMutate,
    isValidating,
    newUpdatesCount,
    selection.kind,
    sourceKey
  ]);

  const lowColor  = isDark ? '#fb7185' : '#be123c';
  const highColor = isDark ? '#a855f7' : '#7e22ce';
  const veryHighColor = isDark ? '#7c3aed' : '#6b21a8';
  const normColor = isDark ? '#34d399' : '#059669';
  const avgColor  = stats.avg < 4 ? lowColor : stats.avg > 10 ? highColor : normColor;

  const hasData = !error && data && data.items.length > 0;
  const selectedReadingIds = selectedPoints
    .map((point) => point.readingId)
    .filter((readingId): readingId is string => Boolean(readingId));
  const hasPreviewCorrection = selectedReadingIds.some((readingId) => previewCorrectionValues[readingId] !== undefined);
  const trimmedCorrectionReason = correctionReasonInput.trim();
  const isCorrectionReasonMissing = trimmedCorrectionReason.length === 0;

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

  function handlePointSelect(point: ChartPoint, additive: boolean) {
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

        const { [readingId]: _removed, ...rest } = current;
        return rest;
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
      await globalMutate(sourceKey);
    } catch (submitError) {
      setCorrectionError(
        submitError instanceof Error ? submitError.message : 'Failed to update glucose correction'
      );
    } finally {
      setIsSavingCorrection(false);
    }
  }

  return (
    <div className="section-stack glucose-analysis-fullwidth">
      {/* Stats Grid — always rendered to prevent layout shift */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

        <DashboardPanel title="Settings" twStyles="overflow-visible">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <span className="ui_micro_label text-text-soft">Time Range</span>
              <div className="flex flex-wrap items-center gap-1">
                {GLUCOSE_TIME_RANGES.map((timeRange) => (
                  <SecondaryButton
                    key={timeRange.key}
                    isActive={activePreset === timeRange.key}
                    onClick={() => setSelection({ kind: 'preset', range: timeRange.key })}
                  >
                    {timeRange.label}
                  </SecondaryButton>
                ))}
                <GlucoseDateRangePicker
                  value={customValue}
                  onApply={(window) => {
                    setSelection({ kind: 'custom', window });
                  }}
                />
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div className="grid gap-2">
                <span className="ui_micro_label text-text-soft">Color Mode</span>
                <SegmentedControl
                  options={GLUCOSE_COLOR_MODES}
                  value={chartColorMode}
                  onChange={updateChartColorMode}
                />
              </div>
              <div className="grid gap-2">
                <span className="ui_micro_label text-text-soft">Y-Axis Max</span>
                <NumberInput
                  label="Top"
                  value={chartYMaxInput}
                  min={12}
                  onChange={setChartYMaxInput}
                  ariaLabel="Chart top value in mmol/L"
                />
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Time in Range" twStyles="flex flex-col [&>div:last-child]:flex-1 [&>div:last-child]:flex [&>div:last-child]:items-center [&>div:last-child]:justify-center">
          {hasData ? (
            <div className="flex items-end justify-center gap-3" style={{ opacity: isTransitioning ? 0.45 : 1, transition: 'opacity 200ms ease' }}>
              <GlucoseStatRing label="Very low" percentage={stats.veryLow.percentage} color={isDark ? '#e11d48' : '#be123c'} size="sm" />
              <GlucoseStatRing label="Low" percentage={stats.low.percentage} color={isDark ? '#fb7185' : '#be123c'} size="md" />
              <GlucoseStatRing label="In range" percentage={stats.inRange.percentage} color={isDark ? '#34d399' : '#059669'} size="lg" />
              <GlucoseStatRing label="High" percentage={stats.high.percentage} color={isDark ? '#a855f7' : '#7e22ce'} size="md" />
              <GlucoseStatRing label="Very high" percentage={stats.veryHigh.percentage} color={veryHighColor} size="sm" />
            </div>
          ) : (
            <div className="flex items-end justify-center gap-3">
              <div className="glucose-skeleton-circle" style={{ width: 44, height: 44 }} />
              <div className="glucose-skeleton-circle" style={{ width: 62, height: 62 }} />
              <div className="glucose-skeleton-circle" style={{ width: 90, height: 90 }} />
              <div className="glucose-skeleton-circle" style={{ width: 62, height: 62 }} />
              <div className="glucose-skeleton-circle" style={{ width: 44, height: 44 }} />
            </div>
          )}
        </DashboardPanel>
      </div>

      {/* Glucose Chart */}
      <DashboardPanel
        title="Glucose Timeline"
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
              {selectedPoints.length > 0 ? (
                <div className="absolute right-4 top-4 z-10 w-[min(30rem,calc(100%-2rem))]">
                  <DashboardPanel title="Active readings" twStyles="shadow-2xl">
                    <div className="flex min-h-[10.5rem] flex-col gap-3">
                      <p className="body_text text-text-soft">
                        {hasPreviewCorrection
                          ? selectedPoints.length === 1
                            ? '1 reading is being adjusted.'
                            : `${selectedPoints.length} readings are being adjusted.`
                          : selectedPoints.length === 1
                            ? '1 reading selected. Click more readings to add them to this correction.'
                            : `${selectedPoints.length} readings selected. Click more readings to keep building this correction.`}
                      </p>
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
                      <div className="mt-auto flex flex-wrap items-end gap-3">
                        <SecondaryButton
                          isActive={false}
                          onClick={() => {
                            void submitCorrection();
                          }}
                          disabled={isSavingCorrection || isCorrectionReasonMissing || !isOwner || !hasPreviewCorrection}
                        >
                          Apply preview
                        </SecondaryButton>
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
                          Preview is available to everyone. Admin sign in is required to apply corrections.
                        </p>
                      ) : null}
                    </div>
                  </DashboardPanel>
                </div>
              ) : null}
              {isTransitioning && (
                <div className="absolute inset-0 z-5 flex items-center justify-center">
                  <div className="glucose-spinner" />
                </div>
              )}
              <div style={{ opacity: isTransitioning ? 0.35 : 1, transition: 'opacity 200ms ease' }}>
                <GlucoseChart
                  data={data.items}
                  basalData={data.basalItems}
                  eventData={data.eventItems}
                  stepData={data.stepItems}
                  height={chartHeight}
                  yMax={chartYMax}
                  colorMode={chartColorMode}
                  editable
                  selectedReadingIds={selectedReadingIds}
                  previewReadingValues={previewCorrectionValues}
                  onPointSelect={handlePointSelect}
                  onCorrectionPreviewChange={handleCorrectionPreviewChange}
                />
              </div>
            </div>
          )}
        </div>
      </DashboardPanel>

      {/* AGP Chart */}
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
                <GlucoseAgpChart data={data.items} height={400} yMax={chartYMax} />
              </div>
            </div>
          ) : (
            <div className="body_text flex items-center justify-center text-text-soft" style={{ height: 400 }}>
              {isFirstLoad ? '' : 'No data available.'}
            </div>
          )}
        </div>
      </DashboardPanel>
    </div>
  );
}
