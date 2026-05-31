import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import { DASHBOARD_ORDER_UPDATED_EVENT } from './const';
import type {
  DashboardRowMeasurements,
  DashboardRowMotion,
  DashboardRowRefs,
  DashboardRowStyle,
} from './types';

export const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
};

export const dispatchDashboardOrderUpdated = (items: DashboardLibraryItem[]) => {
  window.dispatchEvent(new CustomEvent(DASHBOARD_ORDER_UPDATED_EVENT, {
    detail: {
      dashboardOrderUids: items.map((item) => item.uid),
    },
  }));
};

export const getDashboardRowViewTransitionName = (dashboardUid: string): string => {
  return `dashboard-library-row-${dashboardUid.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
};

export const readDashboardRowMeasurements = (rowRefs: DashboardRowRefs): DashboardRowMeasurements => {
  return new Map(
    Array.from(rowRefs.entries()).map(([dashboardUid, row]) => [
      dashboardUid,
      {
        height: row.getBoundingClientRect().height,
        top: row.getBoundingClientRect().top,
      },
    ]),
  );
};

export const getDashboardListGap = (rowRefs: DashboardRowRefs): number => {
  const firstRow = rowRefs.values().next().value;
  const rowGap = firstRow?.parentElement
    ? getComputedStyle(firstRow.parentElement).rowGap
    : '0';

  const parsedGap = Number.parseFloat(rowGap);
  return Number.isNaN(parsedGap) ? 0 : parsedGap;
};

export const parseDurationMs = (value: string): number => {
  const trimmed = value.trim();

  if (trimmed.endsWith('ms')) {
    return Number.parseFloat(trimmed);
  }

  if (trimmed.endsWith('s')) {
    return Number.parseFloat(trimmed) * 1000;
  }

  return 1000;
};

export const getDashboardRowMotionChanges = (
  rowRefs: DashboardRowRefs,
  nextDashboardUids: string[],
): Record<string, DashboardRowMotion> => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return {};
  }

  const measurements = readDashboardRowMeasurements(rowRefs);
  const firstTop = Math.min(...Array.from(measurements.values()).map((measurement) => measurement.top));
  if (!Number.isFinite(firstTop)) {
    return {};
  }
  const rowGap = getDashboardListGap(rowRefs);
  const movedRows: Record<string, DashboardRowMotion> = {};
  let nextTop = firstTop;

  nextDashboardUids.forEach((dashboardUid) => {
    const measurement = measurements.get(dashboardUid);
    if (!measurement) {
      return;
    }

    const offset = measurement.top - nextTop;
    if (Math.abs(offset) < 1) {
      nextTop += measurement.height + rowGap;
      return;
    }

    movedRows[dashboardUid] = {
      offset,
      phase: 'offset',
    };
    nextTop += measurement.height + rowGap;
  });

  return movedRows;
};

export const getDashboardRowStyle = (
  dashboardUid: string,
  motion?: DashboardRowMotion,
): DashboardRowStyle => {
  const motionStyle: CSSProperties = motion
    ? {
        transform: motion.phase === 'offset' ? `translateY(${motion.offset}px)` : 'translateY(0)',
        transition: motion.phase === 'offset'
          ? 'none'
          : 'transform var(--duration-dashboard-order) ease-out',
        zIndex: 1,
      }
    : {};

  return {
    ...motionStyle,
    viewTransitionName: getDashboardRowViewTransitionName(dashboardUid),
    viewTransitionClass: 'dashboard-library-row-transition',
  };
};

export const runDashboardOrderTransition = (
  updateOrder: () => void,
  rowRefs: DashboardRowRefs,
  nextDashboardUids: string[],
  setRowMotion: Dispatch<SetStateAction<Record<string, DashboardRowMotion>>>,
  rowMotionFrameRef: { current: number | null },
  rowMotionTimeoutRef: { current: number | null },
) => {
  const nextMotion = getDashboardRowMotionChanges(rowRefs, nextDashboardUids);
  const scrollLeft = window.scrollX;
  const scrollTop = window.scrollY;
  const shouldRestoreScroll = scrollLeft !== 0 || scrollTop !== 0;
  flushSync(updateOrder);
  if (shouldRestoreScroll) {
    window.scrollTo(scrollLeft, scrollTop);
    window.requestAnimationFrame(() => window.scrollTo(scrollLeft, scrollTop));
  }

  if (Object.keys(nextMotion).length === 0) {
    return;
  }

  if (rowMotionFrameRef.current !== null) {
    window.cancelAnimationFrame(rowMotionFrameRef.current);
  }
  if (rowMotionTimeoutRef.current !== null) {
    window.clearTimeout(rowMotionTimeoutRef.current);
  }

  flushSync(() => setRowMotion(nextMotion));

  rowMotionFrameRef.current = window.requestAnimationFrame(() => {
    setRowMotion((currentMotion) => Object.fromEntries(
      Object.entries(currentMotion).map(([dashboardUid, motion]) => [
        dashboardUid,
        { ...motion, phase: 'animate' },
      ]),
    ));
  });

  const duration = parseDurationMs(
    getComputedStyle(document.documentElement).getPropertyValue('--duration-dashboard-order'),
  );

  rowMotionTimeoutRef.current = window.setTimeout(() => {
    setRowMotion({});
    rowMotionFrameRef.current = null;
    rowMotionTimeoutRef.current = null;
  }, duration + 50);
};
