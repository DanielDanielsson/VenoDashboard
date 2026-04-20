'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { animate } from 'framer-motion';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { GlucoseStatRing } from '@ui/components/GlucoseStatRing/GlucoseStatRing';
import { SegmentedControl } from '@ui/components/SegmentedControl';
import {
  useDashboardPanelSettings,
  type DashboardPanelSettingsRegistration,
} from '@ui/compositions/DashboardGrid';
import { computeGlucoseStats } from '@/lib/glucose/metrics';
import type { GlucoseStats } from '@/lib/glucose/metrics';
import type { GlucoseApiResponse } from '@/lib/glucose/types';

export type TimeInRangePanelLayout = 'overview' | 'statistics';

type TimeInRangePanelSettings = {
  layout: TimeInRangePanelLayout;
};

const TIME_IN_RANGE_PANEL_ID = 'panel-time-in-range';

const SEGMENTS = [
  { key: 'veryLow' as const, label: 'Very Low', color: 'var(--color-base-glucose-low-dark)' },
  { key: 'low' as const, label: 'Low', color: 'var(--color-base-error-dark)' },
  { key: 'inRange' as const, label: 'In Range', color: 'var(--color-base-accent-bright)' },
  { key: 'high' as const, label: 'High', color: 'var(--color-base-glucose-high-dark)' },
  { key: 'veryHigh' as const, label: 'Very High', color: 'var(--color-base-glucose-very-high-dark)' },
] as const;
const DEFAULT_DASHBOARD_RANGE_HOURS = 72;

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 68;

const TIME_IN_RANGE_LAYOUT_OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'statistics', label: 'Statistics' },
] satisfies Array<{ value: TimeInRangePanelLayout; label: string }>;

function slicePath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const sweep = Math.max(0.001, Math.min(359.999, sweepDeg));
  const startRad = (startDeg - 90) * (Math.PI / 180);
  const endRad = (startDeg + sweep - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}

function statsToPercs(stats: GlucoseStats | null): number[] {
  if (!stats) return [0, 0, 0, 0, 0];
  return [
    stats.veryLow.percentage,
    stats.low.percentage,
    stats.inRange.percentage,
    stats.high.percentage,
    stats.veryHigh.percentage,
  ];
}

async function fetchHistory(hours: number): Promise<GlucoseApiResponse> {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  const url = `/api/dashboard/glucose/history?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<GlucoseApiResponse>;
}

function createDefaultSettings(layout: TimeInRangePanelLayout): TimeInRangePanelSettings {
  return { layout };
}

export function createTimeInRangePanelSettingsRegistration(
  defaultLayout: TimeInRangePanelLayout,
): DashboardPanelSettingsRegistration {
  return {
    defaultSettings: createDefaultSettings(defaultLayout),
    render: ({ settings, updateSettings }) => {
      const typedSettings = settings as TimeInRangePanelSettings;
      const updateTypedSettings = updateSettings as (
        updater: (current: TimeInRangePanelSettings) => TimeInRangePanelSettings
      ) => void;

      return (
        <div className="grid gap-2">
          <span className="ui_micro_label text-text-soft">Layout</span>
          <SegmentedControl
            options={TIME_IN_RANGE_LAYOUT_OPTIONS}
            value={typedSettings.layout}
            onChange={(value) => {
              updateTypedSettings((current) => ({ ...current, layout: value as TimeInRangePanelLayout }));
            }}
          />
        </div>
      );
    },
  };
}

interface TimeInRangePanelProps {
  defaultLayout?: TimeInRangePanelLayout;
  dashboardRangeHours?: number;
  stats?: GlucoseStats | null;
  loading?: boolean;
  isDark?: boolean;
}

export function TimeInRangePanel({
  defaultLayout = 'overview',
  dashboardRangeHours = DEFAULT_DASHBOARD_RANGE_HOURS,
  stats: providedStats,
  loading: providedLoading,
  isDark = true,
}: TimeInRangePanelProps) {
  const defaultSettings = useMemo(() => createDefaultSettings(defaultLayout), [defaultLayout]);
  const [settings] = useDashboardPanelSettings(TIME_IN_RANGE_PANEL_ID, defaultSettings);
  const [fetchedStats, setFetchedStats] = useState<GlucoseStats | null>(null);
  const [isFetching, setIsFetching] = useState(providedStats === undefined);
  const [displayPercs, setDisplayPercs] = useState<number[]>([0, 0, 0, 0, 0]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const animatedPercs = useRef<number[]>([0, 0, 0, 0, 0]);

  const stats = providedStats === undefined ? fetchedStats : providedStats;
  const loading = providedLoading ?? (providedStats === undefined ? isFetching : false);

  useEffect(() => {
    if (providedStats !== undefined) {
      return;
    }

    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setIsFetching(true);
      }
    }, 0);
    fetchHistory(dashboardRangeHours)
      .then((data) => {
        if (cancelled) return;
        setFetchedStats(computeGlucoseStats(data.items));
        setErrorMessage(null);
        setIsFetching(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setFetchedStats(null);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load glucose history');
          setIsFetching(false);
        }
      });
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [dashboardRangeHours, providedStats]);

  useEffect(() => {
    const target = statsToPercs(stats);
    const start = [...animatedPercs.current];
    const ctrl = animate(0, 1, {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: (t) => {
        const next = start.map((s, i) => s + (target[i] - s) * t);
        animatedPercs.current = next;
        setDisplayPercs(next);
      },
      onComplete: () => {
        animatedPercs.current = target;
        setDisplayPercs(target);
      },
    });
    return () => ctrl.stop();
  }, [stats]);

  const total = displayPercs.reduce((a, b) => a + b, 0) || 100;
  const paths = displayPercs.map((p, i) => {
    const startDeg = displayPercs.slice(0, i).reduce((s, v) => s + (v / total) * 360, 0);
    const sweep = (p / total) * 360;
    return slicePath(CX, CY, R, startDeg, sweep);
  });

  if (settings.layout === 'statistics') {
    const lowColor  = isDark ? '#fb7185' : '#be123c';
    const highColor = isDark ? '#a855f7' : '#7e22ce';
    const veryHighColor = isDark ? '#7c3aed' : '#6b21a8';
    const normColor = isDark ? '#34d399' : '#059669';

    return (
      <DashboardPanel title="Time in Range" twStyles="flex flex-col [&>div:last-child]:flex-1 [&>div:last-child]:flex [&>div:last-child]:items-center [&>div:last-child]:justify-center">
        {stats ? (
          <div className="flex items-center justify-center gap-5" style={{ opacity: loading ? 0.45 : 1, transition: 'opacity 200ms ease' }}>
            <GlucoseStatRing label="Very low" percentage={stats.veryLow.percentage} color={isDark ? '#e11d48' : '#be123c'} size="sm" />
            <GlucoseStatRing label="Low" percentage={stats.low.percentage} color={lowColor} size="md" />
            <GlucoseStatRing label="In range" percentage={stats.inRange.percentage} color={normColor} size="lg" />
            <GlucoseStatRing label="High" percentage={stats.high.percentage} color={highColor} size="md" />
            <GlucoseStatRing label="Very high" percentage={stats.veryHigh.percentage} color={veryHighColor} size="sm" />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-5">
            <div className="glucose-skeleton-circle" style={{ width: 44, height: 44 }} />
            <div className="glucose-skeleton-circle" style={{ width: 62, height: 62 }} />
            <div className="glucose-skeleton-circle" style={{ width: 90, height: 90 }} />
            <div className="glucose-skeleton-circle" style={{ width: 62, height: 62 }} />
            <div className="glucose-skeleton-circle" style={{ width: 44, height: 44 }} />
          </div>
        )}
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel title="Time In Range">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ opacity: loading ? 0.35 : 1, transition: 'opacity 0.2s ease' }}
        >
          {SEGMENTS.map((seg, i) => (
            <path
              key={seg.key}
              d={paths[i]}
              fill={displayPercs[i] < 0.5 ? 'none' : seg.color}
              style={{ stroke: 'var(--color-dashboard-panel-bg)', strokeWidth: 1.5 }}
            />
          ))}
        </svg>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {SEGMENTS.map((seg, i) => (
            <div key={seg.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  className="ui_micro_label text-text-soft"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {seg.label}
                </span>
              </div>
              <span
                className="text-text"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-plex-mono), monospace',
                  lineHeight: 1,
                }}
              >
                {Math.round(displayPercs[i])}%
              </span>
            </div>
          ))}
        </div>
        {errorMessage ? <p className="ui_caption text-rose-300">{errorMessage}</p> : null}
      </div>
    </DashboardPanel>
  );
}
