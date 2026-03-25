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
import type { GlucoseApiResponse, GlucoseUpdatesResponse } from '@/lib/glucose/types';

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

export function GlucoseAnalysisView() {
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
