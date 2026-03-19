'use client';

import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { GlucoseChart } from '@ui/components/GlucoseChart/GlucoseChart';
import { GlucoseAgpChart } from '@ui/components/GlucoseAgpChart/GlucoseAgpChart';
import { GlucoseDateRangePicker } from '@ui/components/GlucoseDateRangePicker/GlucoseDateRangePicker';
import { GlucoseStatRing } from '@ui/components/GlucoseStatRing/GlucoseStatRing';
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

function getUpdatesKey(timestamp: string): string {
  return `/api/dashboard/glucose/updates?since=${encodeURIComponent(timestamp)}`;
}

function StatValue({
  label,
  value,
  color,
  size = 'sm'
}: {
  label: string;
  value: string;
  color?: string;
  size?: 'sm' | 'lg';
}) {
  return (
    <div style={{ display: 'grid', gap: size === 'lg' ? 5 : 3, alignContent: 'start' }}>
      <span style={{
        fontSize: 10,
        color: 'var(--text-soft)',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        fontWeight: 600,
        lineHeight: 1
      }}>
        {label}
      </span>
      <span style={{
        fontSize: size === 'lg' ? 30 : 14,
        fontWeight: size === 'lg' ? 700 : 600,
        fontFamily: 'var(--font-plex-mono), monospace',
        color: color || 'var(--text)',
        lineHeight: 1
      }}>
        {value}
      </span>
    </div>
  );
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

export function GlucoseAnalysisView() {
  const [selection, setSelection] = useState<HistorySelection>({
    kind: 'preset',
    range: '24h'
  });
  const [chartHeight, setChartHeight] = useState(500);
  const [chartYMaxInput, setChartYMaxInput] = useState('25');
  const [chartColorMode, setChartColorMode] = useState<GlucoseColorMode>('threeColors');
  const [isApplyingUpdates, setIsApplyingUpdates] = useState(false);
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
    revalidateIfStale: false
  });

  const targetWindow = getSelectionTargetWindow(selection, sourceData);
  const data = sourceData && targetWindow
    ? sliceHistoryResponseToWindow(sourceData, targetWindow)
    : sourceData;

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
    setChartHeight(window.innerWidth < 640 ? 340 : 500);
  }, []);

  useEffect(() => {
    try {
      const storedValue = localStorage.getItem(GLUCOSE_CHART_COLOR_MODE_STORAGE_KEY);
      if (storedValue === 'threeColors' || storedValue === 'gradient') {
        setChartColorMode(storedValue);
      }
    } catch {
      setChartColorMode('threeColors');
    }
  }, []);

  useEffect(() => {
    if (data?.latest) {
      window.dispatchEvent(new CustomEvent('pulse-glucose-latest', { detail: data.latest }));
    }
  }, [data?.latest]);

  const stats = computeGlucoseStats(data?.items ?? []);
  const newUpdatesCount = updates?.meta.newCount ?? 0;
  const showLoadingOverlay = !data && isLoading;
  const parsedChartYMax = Number(chartYMaxInput);
  const chartYMax = Number.isFinite(parsedChartYMax) ? Math.max(12, parsedChartYMax) : 25;

  async function applyUpdates() {
    setIsApplyingUpdates(true);
    try {
      await globalMutate(sourceKey);
    } finally {
      setIsApplyingUpdates(false);
    }
  }

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

    if (!displayedLatestTimestamp || newUpdatesCount <= 0 || isApplyingUpdates || isValidating) {
      return;
    }

    setIsApplyingUpdates(true);
    void globalMutate(sourceKey).finally(() => {
      setIsApplyingUpdates(false);
    });
  }, [
    displayedLatestTimestamp,
    globalMutate,
    isApplyingUpdates,
    isValidating,
    newUpdatesCount,
    selection.kind,
    sourceKey
  ]);

  const avgColor = stats.avg < 4 ? '#fb7185' : stats.avg > 10 ? '#fbbf24' : '#34d399';

  return (
    <div className="glucose-analysis-fullwidth">
      <section
        className="panel"
        style={{
          position: 'sticky',
          top: '0',
          zIndex: 30,
          borderRadius: 'var(--radius-2xl)',
          padding: '0.75rem 1.25rem',
          display: 'grid',
          gap: '0.625rem'
        }}
      >
        {/* Row 1: time controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem 1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexShrink: 1,
            minWidth: 0,
            flex: '1 1 auto'
          }}>
            {GLUCOSE_TIME_RANGES.map((timeRange) => (
              <button
                key={timeRange.key}
                type="button"
                onClick={() => setSelection({ kind: 'preset', range: timeRange.key })}
                className={activePreset === timeRange.key ? 'button-primary' : 'button-ghost'}
                style={{ minHeight: '1.875rem', padding: '0 0.625rem', fontSize: '0.775rem', flexShrink: 0 }}
              >
                {timeRange.label}
              </button>
            ))}
            <GlucoseDateRangePicker
              value={customValue}
              onApply={(window) => {
                setSelection({ kind: 'custom', window });
              }}
            />
            {newUpdatesCount > 0 && (
              <button
                type="button"
                onClick={applyUpdates}
                className="button-primary"
                disabled={isApplyingUpdates}
                style={{ minHeight: '1.875rem', padding: '0 0.75rem', fontSize: '0.775rem', marginLeft: 4, flexShrink: 0 }}
              >
                {isApplyingUpdates
                  ? 'Loading...'
                  : `Load ${newUpdatesCount} new`}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-soft)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
              <span>Top</span>
              <input
                type="number"
                min={12}
                step={1}
                inputMode="numeric"
                value={chartYMaxInput}
                onChange={(event) => setChartYMaxInput(event.target.value)}
                style={{
                  width: 64,
                  minHeight: '1.875rem',
                  padding: '0 0.625rem',
                  borderRadius: '999px',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontFamily: 'var(--font-plex-mono), monospace'
                }}
                aria-label="Chart top value in mmol/L"
              />
            </label>
            {data && !showLoadingOverlay && (
              <span style={{ fontSize: 11, color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>
                {data.meta.mergedCount.toLocaleString()} readings
                {data.meta.tandemBasalCount > 0 ? ` · ${data.meta.tandemBasalCount.toLocaleString()} basal changes` : ''}
                {data.meta.tandemEventCount > 0 ? ` · ${data.meta.tandemEventCount.toLocaleString()} tandem events` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: stats */}
        {!showLoadingOverlay && !error && data && data.items.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem 1.5rem',
            flexWrap: 'wrap',
            paddingTop: '0.375rem',
            borderTop: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', flexWrap: 'wrap' }}>
              <StatValue label="Avg" value={stats.avg.toFixed(1)} color={avgColor} size="lg" />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.875rem', paddingBottom: 2 }}>
                <StatValue label="Min" value={stats.min.toFixed(1)} color={stats.min < 4 ? '#fb7185' : 'var(--text-dim)'} />
                <StatValue label="Max" value={stats.max.toFixed(1)} color={stats.max > 10 ? '#fbbf24' : 'var(--text-dim)'} />
                {updatesError && <StatValue label="Updates" value="stale" color="#fb7185" />}
              </div>
            </div>

            <div style={{ overflow: 'hidden', minWidth: 0, flex: '1 1 auto' }}>
              <div style={{
                display: 'flex',
                gap: '0.625rem',
                justifyContent: 'flex-end',
                alignItems: 'center',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                paddingBottom: 2
              }}>
                <GlucoseStatRing label="Very low" percentage={stats.veryLow.percentage} color="#e11d48" />
                <GlucoseStatRing label="Low" percentage={stats.low.percentage} color="#fb7185" />
                <GlucoseStatRing label="In range" percentage={stats.inRange.percentage} color="#34d399" />
                <GlucoseStatRing label="High" percentage={stats.high.percentage} color="#fbbf24" />
                <GlucoseStatRing label="Very high" percentage={stats.veryHigh.percentage} color="#f97316" />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="panel" style={{
        marginTop: '0.75rem',
        borderRadius: 'var(--radius-2xl)',
        overflow: 'hidden',
        padding: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 1rem 0',
          gap: '0.75rem'
        }}>
          <span style={{
            fontSize: 11,
            color: 'var(--text-soft)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0
          }}>
            Drag to pan · Ctrl or Cmd + scroll to zoom
          </span>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: 3,
            borderRadius: '999px',
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)'
          }}>
            {GLUCOSE_COLOR_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => updateChartColorMode(mode)}
                className={chartColorMode === mode ? 'button-primary' : 'button-ghost'}
                style={{ minHeight: '1.625rem', padding: '0 0.625rem', fontSize: '0.725rem' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', minHeight: chartHeight }}>
          {showLoadingOverlay && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 5
            }}>
              <div className="glucose-chart-skeleton" />
              <p style={{ fontSize: 13, color: 'var(--text-soft)' }}>Loading glucose data...</p>
            </div>
          )}

          {error && !showLoadingOverlay && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 5
            }}>
              <p style={{ fontSize: 13, color: '#fb7185' }}>{error.message}</p>
              <button
                type="button"
                onClick={() => mutate()}
                className="button-secondary"
                style={{ minHeight: '2.25rem', fontSize: '0.82rem' }}
              >
                Retry
              </button>
            </div>
          )}

          {!error && data && data.items.length === 0 && !showLoadingOverlay && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: chartHeight,
              color: 'var(--text-soft)',
              fontSize: 14
            }}>
              No glucose data available for this time range.
            </div>
          )}

          {!error && data && data.items.length > 0 && (
            <div style={{ opacity: isValidating || isApplyingUpdates ? 0.55 : 1, transition: 'opacity 200ms ease' }}>
              <GlucoseChart
                data={data.items}
                basalData={data.basalItems}
                eventData={data.eventItems}
                height={chartHeight}
                yMax={chartYMax}
                colorMode={chartColorMode}
              />
            </div>
          )}
        </div>
      </section>

      {!showLoadingOverlay && !error && data && data.items.length > 0 && (
        <section className="panel" style={{ marginTop: '1rem', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
          <GlucoseAgpChart data={data.items} height={chartHeight} yMax={chartYMax} />
        </section>
      )}
    </div>
  );
}
