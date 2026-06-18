'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { GlucoseStatRing } from '@ui/components/GlucoseStatRing/GlucoseStatRing';
import { PieChart } from '@ui/components/PieChart';
import { SegmentedControl } from '@ui/components/SegmentedControl';
import {
  useDashboardPanelSettings,
  type DashboardPanelSettingsRegistration,
} from '@ui/compositions/DashboardGrid';
import { computeGlucoseStats } from '@/lib/glucose/metrics';
import type { GlucoseStats } from '@/lib/glucose/metrics';
import type { GlucoseApiResponse } from '@/lib/glucose/types';
import { buildTimeInRangePieSlices } from './timeInRangeChart';

export type TimeInRangePanelLayout = 'overview' | 'statistics';

type TimeInRangePanelSettings = {
  layout: TimeInRangePanelLayout;
};

const TIME_IN_RANGE_PANEL_ID = 'panel-time-in-range';

const DEFAULT_DASHBOARD_RANGE_HOURS = 72;

const TIME_IN_RANGE_LAYOUT_OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'statistics', label: 'Statistics' },
] satisfies Array<{ value: TimeInRangePanelLayout; label: string }>;

const fetchHistory = async (hours: number): Promise<GlucoseApiResponse> => {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  const url = `/api/dashboard/glucose/history?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<GlucoseApiResponse>;
};

const createDefaultSettings = (layout: TimeInRangePanelLayout): TimeInRangePanelSettings => {
  return { layout };
};

export const createTimeInRangePanelSettingsRegistration = (
  defaultLayout: TimeInRangePanelLayout,
): DashboardPanelSettingsRegistration => {
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
};

interface TimeInRangePanelProps {
  defaultLayout?: TimeInRangePanelLayout;
  dashboardRangeHours?: number;
  panelId?: string;
  stats?: GlucoseStats | null;
  loading?: boolean;
  isDark?: boolean;
}

export const TimeInRangePanel = ({
  defaultLayout = 'overview',
  dashboardRangeHours = DEFAULT_DASHBOARD_RANGE_HOURS,
  panelId = TIME_IN_RANGE_PANEL_ID,
  stats: providedStats,
  loading: providedLoading,
  isDark = true,
}: TimeInRangePanelProps) => {
  const defaultSettings = useMemo(() => createDefaultSettings(defaultLayout), [defaultLayout]);
  const [settings] = useDashboardPanelSettings(panelId, defaultSettings);
  const [fetchedStats, setFetchedStats] = useState<GlucoseStats | null>(null);
  const [isFetching, setIsFetching] = useState(providedStats === undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stats = providedStats === undefined ? fetchedStats : providedStats;
  const loading = providedLoading ?? (providedStats === undefined ? isFetching : false);
  const pieSlices = useMemo(() => buildTimeInRangePieSlices(stats), [stats]);

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
      <div className="grid gap-4">
        <div style={{ opacity: loading ? 0.35 : 1, transition: 'opacity 0.2s ease' }}>
          <PieChart
            ariaLabel="Time in range distribution"
            data={pieSlices}
            centerValue={`${Math.round(stats?.inRange.percentage ?? 0)}%`}
            centerLabel="In range"
            formatValue={(slice) => `${Math.round(slice.value)}%`}
          />
        </div>
        {errorMessage ? <p className="ui_caption text-base-error-dark">{errorMessage}</p> : null}
      </div>
    </DashboardPanel>
  );
};
