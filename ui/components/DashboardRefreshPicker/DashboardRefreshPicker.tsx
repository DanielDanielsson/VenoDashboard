'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import type { HistoryWindow } from '@/lib/glucose/history-cache';
import {
  DASHBOARD_REFRESH_AUTO,
  DASHBOARD_REFRESH_OFF,
  resolveRefreshIntervalMs,
} from '@/lib/dashboard/refresh';

interface DashboardRefreshPickerProps {
  value: string;
  intervals: string[];
  currentWindow: HistoryWindow | null;
  onChange: (value: string) => void;
  onRefresh: () => void | Promise<void>;
}

function refreshLabel(value: string): string {
  if (value === DASHBOARD_REFRESH_OFF) {
    return 'Off';
  }

  if (value === DASHBOARD_REFRESH_AUTO) {
    return 'Auto';
  }

  return value;
}

export function DashboardRefreshPicker({
  value,
  intervals,
  currentWindow,
  onChange,
  onRefresh,
}: DashboardRefreshPickerProps): ReactElement {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth || 1440,
  );
  const refreshInFlightRef = useRef(false);
  const pendingVisibleRefreshRef = useRef(false);
  const intervalMs = useMemo(
    () => resolveRefreshIntervalMs(value, currentWindow, viewportWidth),
    [currentWindow, value, viewportWidth],
  );

  const runRefresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    try {
      await onRefresh();
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [onRefresh]);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth || 1440);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!intervalMs) {
      pendingVisibleRefreshRef.current = false;
      return;
    }

    function tick() {
      if (document.hidden) {
        pendingVisibleRefreshRef.current = true;
        return;
      }

      void runRefresh();
    }

    function handleVisibilityChange() {
      if (document.hidden || !pendingVisibleRefreshRef.current) {
        return;
      }

      pendingVisibleRefreshRef.current = false;
      void runRefresh();
    }

    const timer = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, runRefresh]);

  return (
    <div
      className="inline-flex h-9 overflow-hidden rounded-[4px] border border-dashboard-time-picker-border bg-dashboard-time-picker-bg text-dashboard-time-picker-text shadow-sm"
      data-testid="dashboard-refresh-picker"
    >
      <Button
        ariaLabel="Refresh dashboard"
        twStyles="grid h-9 w-9 place-items-center border-r border-dashboard-time-picker-border text-dashboard-time-picker-text-muted transition-colors hover:bg-dashboard-time-picker-bg-hover hover:text-dashboard-time-picker-text"
        onClick={() => void runRefresh()}
      >
        <Icon icon="refresh" twStyles="h-4 w-4" />
      </Button>
      <label className="relative flex h-9 items-center">
        <span className="sr-only">Dashboard refresh interval</span>
        <select
          aria-label="Dashboard refresh interval"
          className="ui_caption h-9 min-w-[5.25rem] cursor-pointer appearance-none bg-transparent px-3 pr-7 text-dashboard-time-picker-text outline-none transition-colors hover:bg-dashboard-time-picker-bg-hover"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value={DASHBOARD_REFRESH_OFF}>Off</option>
          <option value={DASHBOARD_REFRESH_AUTO}>Auto</option>
          {intervals.map((interval) => (
            <option key={interval} value={interval}>
              {refreshLabel(interval)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 text-dashboard-time-picker-text-muted" aria-hidden="true">
          <Icon icon="chevron-down" twStyles="h-3.5 w-3.5" />
        </span>
      </label>
    </div>
  );
}
