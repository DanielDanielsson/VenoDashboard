'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type CSSProperties,
  type SetStateAction,
} from 'react';
import { flushSync } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { Link } from '@ui/base/Link';
import { DialogPanel } from '@ui/components/DialogPanel';
import { SecondaryButton } from '@ui/components/SecondaryButton';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import { getDashboardDescriptionText } from '@/lib/dashboard/metadata';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import { DashboardMetadataSettings } from './DashboardMetadataSettings';
import {
  getDashboardPreferencePayload,
  moveDashboardItem,
  orderDashboardItems,
  reorderDashboardItems,
  type DashboardDropPosition,
} from './utils';

const DASHBOARD_TYPE_LABEL: Record<DashboardLibraryItem['type'], string> = {
  live: 'Live',
  timeRange: 'Time range',
};

const DASHBOARD_TYPE_ICON: Record<DashboardLibraryItem['type'], 'glucose' | 'clock'> = {
  live: 'glucose',
  timeRange: 'clock',
};

const DASHBOARD_SETTINGS_PARAM = 'settings';

const DASHBOARD_TYPE_OPTIONS = [
  { value: 'live', label: 'Live', icon: 'glucose' },
  { value: 'timeRange', label: 'Time range', icon: 'clock' },
] as const satisfies readonly {
  value: DashboardLibraryItem['type'];
  label: string;
  icon: 'glucose' | 'clock';
}[];

const DASHBOARD_LIBRARY_COLUMNS = {
  owner: 'grid-cols-[2.25rem_minmax(0,1fr)] md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)]',
  public: 'md:grid-cols-2',
};

const DASHBOARD_LIBRARY_DETAIL_COLUMNS = {
  owner: 'md:grid-cols-[10rem_minmax(0,1fr)_8.5rem]',
  public: 'md:grid-cols-[10rem_minmax(0,1fr)_4rem]',
};

const DASHBOARD_LIBRARY_LINK_RIGHT = {
  owner: 'right-[9.75rem]',
  public: 'right-[5.25rem]',
};

const DASHBOARD_ORDER_UPDATED_EVENT = 'veno:dashboard-order-updated';

type PendingDirtyAction =
  | { type: 'collapse' }
  | { type: 'expand'; dashboardUid: string }
  | { type: 'navigate'; href: string };

interface DashboardDropTarget {
  dashboardUid: string;
  position: DashboardDropPosition;
}

interface DashboardLibraryProps {
  dashboards: DashboardLibraryItem[];
  isOwner: boolean;
}

type DashboardRowStyle = CSSProperties & {
  viewTransitionName?: string;
  viewTransitionClass?: string;
};

interface DashboardRowMotion {
  offset: number;
  phase: 'offset' | 'animate';
}

type DashboardRowRefs = Map<string, HTMLLIElement>;
type DashboardRowMeasurements = Map<string, {
  height: number;
  top: number;
}>;

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

function dispatchDashboardOrderUpdated(items: DashboardLibraryItem[]) {
  window.dispatchEvent(new CustomEvent(DASHBOARD_ORDER_UPDATED_EVENT, {
    detail: {
      dashboardOrderUids: items.map((item) => item.uid),
    },
  }));
}

function getDashboardRowViewTransitionName(dashboardUid: string): string {
  return `dashboard-library-row-${dashboardUid.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function readDashboardRowMeasurements(rowRefs: DashboardRowRefs): DashboardRowMeasurements {
  return new Map(
    Array.from(rowRefs.entries()).map(([dashboardUid, row]) => [
      dashboardUid,
      {
        height: row.getBoundingClientRect().height,
        top: row.getBoundingClientRect().top,
      },
    ]),
  );
}

function getDashboardListGap(rowRefs: DashboardRowRefs): number {
  const firstRow = rowRefs.values().next().value;
  const rowGap = firstRow?.parentElement
    ? getComputedStyle(firstRow.parentElement).rowGap
    : '0';

  const parsedGap = Number.parseFloat(rowGap);
  return Number.isNaN(parsedGap) ? 0 : parsedGap;
}

function parseDurationMs(value: string): number {
  const trimmed = value.trim();

  if (trimmed.endsWith('ms')) {
    return Number.parseFloat(trimmed);
  }

  if (trimmed.endsWith('s')) {
    return Number.parseFloat(trimmed) * 1000;
  }

  return 1000;
}

function getDashboardRowMotionChanges(
  rowRefs: DashboardRowRefs,
  nextDashboardUids: string[],
): Record<string, DashboardRowMotion> {
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
}

function getDashboardRowStyle(
  dashboardUid: string,
  motion?: DashboardRowMotion,
): DashboardRowStyle {
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
}

function runDashboardOrderTransition(
  updateOrder: () => void,
  rowRefs: DashboardRowRefs,
  nextDashboardUids: string[],
  setRowMotion: Dispatch<SetStateAction<Record<string, DashboardRowMotion>>>,
  rowMotionFrameRef: { current: number | null },
  rowMotionTimeoutRef: { current: number | null },
) {
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
}

export function DashboardLibrary({ dashboards, isOwner }: DashboardLibraryProps) {
  const router = useRouter();
  const { notifyError } = useNotifications();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(dashboards);
  const [savingDashboardUid, setSavingDashboardUid] = useState<string | null>(null);
  const [expandedDashboardUid, setExpandedDashboardUid] = useState<string | null>(null);
  const [settingsDashboardUid, setSettingsDashboardUid] = useState<string | null>(
    () => searchParams.get(DASHBOARD_SETTINGS_PARAM),
  );
  const [dirtyDashboardUid, setDirtyDashboardUid] = useState<string | null>(null);
  const [pendingDirtyAction, setPendingDirtyAction] = useState<PendingDirtyAction | null>(null);
  const [pendingHomeDashboard, setPendingHomeDashboard] = useState<DashboardLibraryItem | null>(null);
  const [draggedDashboardUid, setDraggedDashboardUid] = useState<string | null>(null);
  const [settledDashboardUid, setSettledDashboardUid] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DashboardDropTarget | null>(null);
  const [rowMotion, setRowMotion] = useState<Record<string, DashboardRowMotion>>({});
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const dashboardRowRefs = useRef(new Map<string, HTMLLIElement>());
  const draggedDashboardUidRef = useRef<string | null>(null);
  const rowMotionFrameRef = useRef<number | null>(null);
  const rowMotionTimeoutRef = useRef<number | null>(null);
  const scrolledSettingsUidRef = useRef<string | null>(null);
  const initialSettingsDashboardUidRef = useRef<string | null>(searchParams.get(DASHBOARD_SETTINGS_PARAM));
  const dashboardLibraryColumns = isOwner ? DASHBOARD_LIBRARY_COLUMNS.owner : DASHBOARD_LIBRARY_COLUMNS.public;
  const dashboardLibraryDetailColumns = isOwner ? DASHBOARD_LIBRARY_DETAIL_COLUMNS.owner : DASHBOARD_LIBRARY_DETAIL_COLUMNS.public;
  const dashboardLinkRightClass = isOwner ? DASHBOARD_LIBRARY_LINK_RIGHT.owner : DASHBOARD_LIBRARY_LINK_RIGHT.public;

  const homeDashboardUid = useMemo(
    () => items.find((dashboard) => dashboard.isHome)?.uid ?? items[0]?.uid ?? '',
    [items],
  );
  const pinnedDashboardUids = useMemo(
    () => items.filter((dashboard) => dashboard.isPinned).map((dashboard) => dashboard.uid),
    [items],
  );
  const dashboardOrderUids = useMemo(
    () => items.map((dashboard) => dashboard.uid),
    [items],
  );

  useEffect(() => () => {
    if (rowMotionFrameRef.current !== null) {
      window.cancelAnimationFrame(rowMotionFrameRef.current);
    }
    if (rowMotionTimeoutRef.current !== null) {
      window.clearTimeout(rowMotionTimeoutRef.current);
    }
  }, []);

  const saveDashboardOrder = useCallback(async (
    nextItems: DashboardLibraryItem[],
  ) => {
    if (!isOwner) {
      return;
    }

    setIsSavingOrder(true);

    try {
      const preferences = getDashboardPreferencePayload(nextItems);
      const response = await fetch('/api/dashboard/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard order could not be saved'));
      }

      const payload = await response.json() as {
        preferences?: {
          homeDashboardUid?: string;
          pinnedDashboardUids?: string[];
          dashboardOrderUids?: string[];
        };
      };
      const savedHomeDashboardUid = payload.preferences?.homeDashboardUid ?? preferences.homeDashboardUid;
      const savedPinnedDashboardUids = new Set(payload.preferences?.pinnedDashboardUids ?? preferences.pinnedDashboardUids);
      const savedDashboardOrderUids = payload.preferences?.dashboardOrderUids ?? preferences.dashboardOrderUids;

      setItems((currentItems) => orderDashboardItems(
        currentItems.map((item) => ({
          ...item,
          isHome: item.uid === savedHomeDashboardUid,
          isPinned: savedPinnedDashboardUids.has(item.uid),
        })),
        savedDashboardOrderUids,
      ));
    } catch (error) {
      notifyError('Dashboard order could not be saved', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSavingOrder(false);
    }
  }, [isOwner, notifyError]);
  const handleDirtyChange = useCallback((dashboardUid: string, isDirty: boolean) => {
    if (!isOwner) {
      return;
    }

    setDirtyDashboardUid((currentUid) => {
      if (isDirty) {
        return dashboardUid;
      }

      return currentUid === dashboardUid ? null : currentUid;
    });
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner || !dirtyDashboardUid) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyDashboardUid, isOwner]);

  useEffect(() => {
    setSettingsDashboardUid(searchParams.get(DASHBOARD_SETTINGS_PARAM));
  }, [searchParams]);

  useEffect(() => {
    if (!settingsDashboardUid) {
      setExpandedDashboardUid(null);
      scrolledSettingsUidRef.current = null;
      initialSettingsDashboardUidRef.current = null;
      return;
    }

    const matchingDashboard = items.find((dashboard) => dashboard.uid === settingsDashboardUid);

    if (!matchingDashboard) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete(DASHBOARD_SETTINGS_PARAM);
      const nextSearch = nextParams.toString();
      window.history.replaceState(null, '', nextSearch ? `${pathname}?${nextSearch}` : pathname);
      setSettingsDashboardUid(null);
      setExpandedDashboardUid(null);
      scrolledSettingsUidRef.current = null;
      initialSettingsDashboardUidRef.current = null;
      return;
    }

    setExpandedDashboardUid((currentUid) => (
      currentUid === matchingDashboard.uid ? currentUid : matchingDashboard.uid
    ));
  }, [items, pathname, searchParams, settingsDashboardUid]);

  useEffect(() => {
    const initialSettingsDashboardUid = initialSettingsDashboardUidRef.current;

    if (
      !initialSettingsDashboardUid ||
      !expandedDashboardUid ||
      settingsDashboardUid !== expandedDashboardUid ||
      expandedDashboardUid !== initialSettingsDashboardUid
    ) {
      return;
    }

    if (scrolledSettingsUidRef.current === expandedDashboardUid) {
      return;
    }

    const dashboardRow = dashboardRowRefs.current.get(expandedDashboardUid);
    dashboardRow?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    scrolledSettingsUidRef.current = expandedDashboardUid;
    initialSettingsDashboardUidRef.current = null;
  }, [expandedDashboardUid, settingsDashboardUid]);

  function updateSettingsUrl(dashboardUid: string | null, navigationMode: 'push' | 'replace' = 'push') {
    const nextParams = new URLSearchParams(window.location.search);

    if (dashboardUid) {
      nextParams.set(DASHBOARD_SETTINGS_PARAM, dashboardUid);
    } else {
      nextParams.delete(DASHBOARD_SETTINGS_PARAM);
    }

    const nextSearch = nextParams.toString();
    const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    const currentHref = `${window.location.pathname}${window.location.search}`;

    if (nextHref === currentHref) {
      setSettingsDashboardUid(dashboardUid);
      return;
    }

    if (navigationMode === 'replace') {
      window.history.replaceState(null, '', nextHref);
      setSettingsDashboardUid(dashboardUid);
      return;
    }

    window.history.pushState(null, '', nextHref);
    setSettingsDashboardUid(dashboardUid);
  }

  function setExpandedSettingsDashboardUid(
    dashboardUid: string | null,
    navigationMode: 'push' | 'replace' = 'push',
  ) {
    setExpandedDashboardUid(dashboardUid);
    updateSettingsUrl(dashboardUid, navigationMode);
  }

  function requestSettingsToggle(dashboardUid: string) {
    const nextAction: PendingDirtyAction = expandedDashboardUid === dashboardUid
      ? { type: 'collapse' }
      : { type: 'expand', dashboardUid };

    if (isOwner && dirtyDashboardUid) {
      setPendingDirtyAction(nextAction);
      return;
    }

    setExpandedSettingsDashboardUid(nextAction.type === 'expand' ? nextAction.dashboardUid : null);
  }

  function handleDashboardLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!isOwner || !dirtyDashboardUid) {
      return;
    }

    event.preventDefault();
    setPendingDirtyAction({ type: 'navigate', href });
  }

  function handleDiscardSettingsChanges() {
    const nextAction = pendingDirtyAction;
    setPendingDirtyAction(null);
    setDirtyDashboardUid(null);

    if (!nextAction) {
      return;
    }

    if (nextAction.type === 'navigate') {
      router.push(nextAction.href);
      return;
    }

    setExpandedSettingsDashboardUid(nextAction.type === 'expand' ? nextAction.dashboardUid : null);
  }

  function handleDashboardDragStart(event: DragEvent<HTMLButtonElement>, dashboardUid: string) {
    if (!isOwner || isSavingOrder) {
      event.preventDefault();
      return;
    }

    const dashboardRow = dashboardRowRefs.current.get(dashboardUid);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dashboardUid);
    if (dashboardRow) {
      event.dataTransfer.setDragImage(dashboardRow, 24, dashboardRow.offsetHeight / 2);
    }
    draggedDashboardUidRef.current = dashboardUid;
    setDraggedDashboardUid(dashboardUid);
    setDropTarget(null);
  }

  function getDashboardDropTargetFromPoint(clientY: number): DashboardDropTarget | null {
    for (const dashboard of items) {
      const row = dashboardRowRefs.current.get(dashboard.uid);
      if (!row) {
        continue;
      }

      const bounds = row.getBoundingClientRect();
      if (clientY < bounds.top) {
        return { dashboardUid: dashboard.uid, position: 'before' };
      }

      if (clientY <= bounds.bottom) {
        return {
          dashboardUid: dashboard.uid,
          position: clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
        };
      }
    }

    const lastDashboard = items.at(-1);
    return lastDashboard ? { dashboardUid: lastDashboard.uid, position: 'after' } : null;
  }

  function handleDashboardListDragOver(event: DragEvent<HTMLUListElement>) {
    const activeDashboardUid = draggedDashboardUidRef.current ?? draggedDashboardUid;
    if (!isOwner || !activeDashboardUid) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const nextTarget = getDashboardDropTargetFromPoint(event.clientY);
    if (!nextTarget) {
      setDropTarget(null);
      return;
    }

    setDropTarget((currentTarget) => (
      currentTarget?.dashboardUid === nextTarget.dashboardUid && currentTarget.position === nextTarget.position
        ? currentTarget
        : nextTarget
    ));
  }

  function handleDashboardListDragLeave(event: DragEvent<HTMLUListElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setDropTarget(null);
  }

  function handleDashboardDragEnd() {
    draggedDashboardUidRef.current = null;
    setDraggedDashboardUid(null);
    setDropTarget(null);
  }

  function handleDashboardListDrop(event: DragEvent<HTMLUListElement>) {
    event.preventDefault();
    const activeDashboardUid = draggedDashboardUidRef.current ?? draggedDashboardUid;
    const target = dropTarget ?? getDashboardDropTargetFromPoint(event.clientY);

    if (!isOwner || !activeDashboardUid || !target || activeDashboardUid === target.dashboardUid) {
      handleDashboardDragEnd();
      return;
    }

    const nextItems = reorderDashboardItems(items, activeDashboardUid, target.dashboardUid, target.position);
    handleDashboardDragEnd();

    if (nextItems === items) {
      return;
    }

    runDashboardOrderTransition(
      () => {
        setSettledDashboardUid(activeDashboardUid);
        setItems(nextItems);
      },
      dashboardRowRefs.current,
      nextItems.map((item) => item.uid),
      setRowMotion,
      rowMotionFrameRef,
      rowMotionTimeoutRef,
    );
    dispatchDashboardOrderUpdated(nextItems);
    void saveDashboardOrder(nextItems);
  }

  function handleDashboardGrabberKeyDown(event: KeyboardEvent<HTMLButtonElement>, dashboardUid: string) {
    if (!isOwner || isSavingOrder || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return;
    }

    event.preventDefault();
    const nextItems = moveDashboardItem(items, dashboardUid, event.key === 'ArrowUp' ? -1 : 1);

    if (nextItems === items) {
      return;
    }

    runDashboardOrderTransition(
      () => {
        setSettledDashboardUid(dashboardUid);
        setItems(nextItems);
      },
      dashboardRowRefs.current,
      nextItems.map((item) => item.uid),
      setRowMotion,
      rowMotionFrameRef,
      rowMotionTimeoutRef,
    );
    dispatchDashboardOrderUpdated(nextItems);
    void saveDashboardOrder(nextItems);
  }

  return (
    <div className="relative grid gap-4">
      {isOwner ? <DashboardCreateForm /> : null}
      <div
        className={`hidden gap-6 rounded-[4px] border border-dashboard-panel-border bg-dashboard-panel-header-bg p-5 md:grid md:items-center ${dashboardLibraryColumns}`}
        data-testid="dashboard-library-header"
      >
        {isOwner ? <span aria-hidden="true" /> : null}
        <span className="body_text text-text-soft">Name</span>
        <span className={`grid gap-6 ${dashboardLibraryDetailColumns}`}>
          <span className="body_text text-text-soft">Type</span>
          <span className="body_text text-text-soft">Tag</span>
          <span aria-hidden="true" />
        </span>
      </div>
      <ul
        aria-label="Dashboards"
        className="dashboard-library-list grid gap-2"
        onDragOver={handleDashboardListDragOver}
        onDragLeave={handleDashboardListDragLeave}
        onDrop={handleDashboardListDrop}
      >
        {items.map((dashboard) => (
          <li
            key={dashboard.uid}
            ref={(node) => {
              if (node) {
                dashboardRowRefs.current.set(dashboard.uid, node);
                return;
              }

              dashboardRowRefs.current.delete(dashboard.uid);
            }}
            className={twMerge(
              'dashboard-library-row relative overflow-hidden rounded-[6px] border border-dashboard-panel-border bg-dashboard-panel-bg shadow-sm hover:border-text-soft',
              draggedDashboardUid === dashboard.uid && 'opacity-60 ring-1 ring-text-soft',
            )}
            data-dashboard-order-state={settledDashboardUid === dashboard.uid ? 'settled' : undefined}
            style={getDashboardRowStyle(dashboard.uid, rowMotion[dashboard.uid])}
            onAnimationEnd={(event) => {
              if (event.currentTarget === event.target) {
                setSettledDashboardUid((currentUid) => currentUid === dashboard.uid ? null : currentUid);
              }
            }}
          >
            {dropTarget?.dashboardUid === dashboard.uid && draggedDashboardUid !== dashboard.uid ? (
              <span
                aria-hidden="true"
                className={twMerge(
                  'pointer-events-none absolute left-3 right-3 z-20 h-0.5 rounded-full bg-accent shadow-sm',
                  dropTarget.position === 'before' ? 'top-0' : 'bottom-0',
                )}
              />
            ) : null}
            <article className={`relative grid min-h-[4.5rem] gap-6 p-5 ${dashboardLibraryColumns}`}>
              <Link
                ariaLabel={`Open ${dashboard.title} dashboard`}
                href={`/dashboards/${dashboard.uid}`}
                onClick={(event) => handleDashboardLinkClick(event, `/dashboards/${dashboard.uid}`)}
                twStyles={`absolute inset-y-0 left-0 z-0 hidden transition-colors hover:bg-dashboard-time-picker-bg-hover md:block ${dashboardLinkRightClass}`}
              >
                <span className="sr-only">Open {dashboard.title} dashboard</span>
              </Link>
              {isOwner ? (
                <span className="z-[3] flex items-center justify-start">
                  <Button
                    ariaLabel={`Drag ${dashboard.title} to reorder`}
                    disabled={isSavingOrder}
                    draggable={!isSavingOrder}
                    onDragStart={(event) => handleDashboardDragStart(event, dashboard.uid)}
                    onDragEnd={handleDashboardDragEnd}
                    onKeyDown={(event) => handleDashboardGrabberKeyDown(event, dashboard.uid)}
                    title={`Drag ${dashboard.title} to reorder`}
                    twStyles="grid h-10 w-8 place-items-center rounded-[4px] text-text-soft transition-colors hover:bg-dashboard-time-picker-bg-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong cursor-grab active:cursor-grabbing"
                  >
                    <Icon icon="grabber" twStyles="h-6 w-6" />
                  </Button>
                </span>
              ) : null}
              <span className="pointer-events-none z-[1] grid min-w-0 content-center gap-1">
                <span className="flex min-w-0 items-center gap-3">
                  <Icon
                    icon={dashboard.icon ?? 'dashboard-grid'}
                    twStyles="h-5 w-5 flex-none text-text-soft"
                  />
                  <span className="body_text min-w-0 truncate text-dashboard-panel-title">
                    {dashboard.title}
                  </span>
                </span>
                {getDashboardDescriptionText(dashboard.description) ? (
                  <span className="body_text overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] text-text-soft">
                    {getDashboardDescriptionText(dashboard.description)}
                  </span>
                ) : null}
              </span>
              <div className={`z-[1] grid min-w-0 gap-4 md:items-center md:gap-6 ${isOwner ? 'col-start-2 md:col-start-auto' : ''} ${dashboardLibraryDetailColumns}`}>
                <span className="pointer-events-none flex items-center">
                  <DashboardLibraryBadge icon={DASHBOARD_TYPE_ICON[dashboard.type]}>
                    {DASHBOARD_TYPE_LABEL[dashboard.type]}
                  </DashboardLibraryBadge>
                </span>
                <span className="pointer-events-none flex flex-wrap items-center gap-2">
                  {dashboard.isHome ? (
                    <DashboardLibraryBadge tone="success">Home</DashboardLibraryBadge>
                  ) : null}
                  {dashboard.isPinned ? (
                    <DashboardLibraryBadge>Pinned</DashboardLibraryBadge>
                  ) : null}
                </span>

                <div className="z-[2] flex flex-nowrap justify-end gap-2 md:items-center">
                  {isOwner ? (
                    <>
                      <DashboardHomeButton
                        dashboard={dashboard}
                        isSaving={savingDashboardUid === dashboard.uid}
                        onRequestHomeDashboard={setPendingHomeDashboard}
                      />
                      <DashboardPinButton
                        dashboard={dashboard}
                        homeDashboardUid={homeDashboardUid}
                        pinnedDashboardUids={pinnedDashboardUids}
                        dashboardOrderUids={dashboardOrderUids}
                        isSaving={savingDashboardUid === dashboard.uid}
                        setSavingDashboardUid={setSavingDashboardUid}
                        setItems={setItems}
                      />
                    </>
                  ) : null}
                  <Button
                    ariaLabel={`${expandedDashboardUid === dashboard.uid ? 'Close' : 'Open'} ${dashboard.title} settings`}
                    title={`${expandedDashboardUid === dashboard.uid ? 'Close' : 'Open'} ${dashboard.title} settings`}
                    twStyles="grid h-10 w-10 shrink-0 place-items-center rounded-[5px] border border-border text-text-soft transition-colors hover:border-text-soft hover:text-text"
                    onClick={() => requestSettingsToggle(dashboard.uid)}
                  >
                    <Icon icon="more-horizontal" twStyles="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </article>
            {expandedDashboardUid === dashboard.uid ? (
              <DashboardMetadataSettings
                dashboard={dashboard}
                isOwner={isOwner}
                onDeleted={(dashboardUid) => {
                  setExpandedDashboardUid((currentUid) => {
                    if (currentUid !== dashboardUid) {
                      return currentUid;
                    }

                    updateSettingsUrl(null, 'replace');
                    return null;
                  });
                  setDirtyDashboardUid((currentUid) => currentUid === dashboardUid ? null : currentUid);
                }}
                onDirtyChange={handleDirtyChange}
                onSaved={(previousUid, nextUid) => {
                  setExpandedDashboardUid((currentUid) => {
                    if (currentUid !== previousUid) {
                      return currentUid;
                    }

                    updateSettingsUrl(nextUid, 'replace');
                    return nextUid;
                  });
                  setDirtyDashboardUid((currentUid) => currentUid === previousUid ? null : currentUid);
                }}
                setItems={setItems}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {pendingDirtyAction ? (
        <DialogPanel title="Discard unsaved dashboard settings?">
          <div className="flex flex-col gap-4">
            <p className="body_text text-text-soft">
              Your unsaved dashboard settings will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <SecondaryButton
                aria-label="Keep editing"
                onClick={() => setPendingDirtyAction(null)}
              >
                Keep editing
              </SecondaryButton>
              <SecondaryButton
                aria-label="Discard settings changes"
                onClick={handleDiscardSettingsChanges}
              >
                Discard changes
              </SecondaryButton>
            </div>
          </div>
        </DialogPanel>
      ) : null}
      {pendingHomeDashboard ? (
        <DashboardHomeConfirmationDialog
          dashboard={pendingHomeDashboard}
          dashboardOrderUids={dashboardOrderUids}
          pinnedDashboardUids={pinnedDashboardUids}
          onCancel={() => setPendingHomeDashboard(null)}
          onSaved={() => setPendingHomeDashboard(null)}
          setItems={setItems}
          setSavingDashboardUid={setSavingDashboardUid}
        />
      ) : null}
    </div>
  );
}

function DashboardLibraryBadge({
  children,
  icon,
  tone = 'muted',
}: {
  children: string;
  icon?: 'glucose' | 'clock';
  tone?: 'muted' | 'success';
}) {
  const toneClass = tone === 'success'
    ? 'border-success text-success'
    : 'border-border text-text-soft';

  return (
    <span className={`ui_micro_label inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 ${toneClass}`}>
      {icon ? <Icon icon={icon} twStyles="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function DashboardCreateForm() {
  const router = useRouter();
  const { notifyError, notifySuccess } = useNotifications();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DashboardLibraryItem['type']>('timeRange');
  const [isSaving, setIsSaving] = useState(false);

  async function createDashboard() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      notifyError('Dashboard title is required');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/dashboard/dashboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: normalizedTitle,
          type,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard could not be created'));
      }

      const payload = await response.json() as {
        dashboard?: {
          uid?: string;
        };
      };
      const dashboardUid = payload.dashboard?.uid;
      if (!dashboardUid) {
        throw new Error('Created dashboard response did not include a dashboard uid.');
      }

      notifySuccess('Dashboard created');
      router.push(`/dashboards/${dashboardUid}`);
    } catch (error) {
      notifyError('Dashboard could not be created', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-[6px] border border-dashboard-panel-border bg-dashboard-panel-bg p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem_auto] md:items-end">
        <label className="grid gap-2">
          <span className="ui_micro_label text-text-soft">Dashboard title</span>
          <input
            className="body_text rounded-[5px] border border-border bg-bg px-3 py-2 text-text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <fieldset className="grid gap-2">
          <legend className="ui_micro_label text-text-soft">Dashboard type</legend>
          <div className="grid grid-cols-2 gap-2">
            {DASHBOARD_TYPE_OPTIONS.map((option) => {
              const isSelected = type === option.value;

              return (
                <Button
                  ariaLabel={`Select ${option.label} dashboard type`}
                  aria-pressed={isSelected}
                  key={option.value}
                  twStyles={`grid min-h-20 place-items-center gap-1 rounded-[5px] border px-3 py-3 transition-colors ${
                    isSelected
                      ? 'border-text-soft bg-dashboard-time-picker-bg-hover text-dashboard-time-picker-text'
                      : 'border-border text-text-soft hover:border-text-soft hover:text-text'
                  }`}
                  onClick={() => setType(option.value)}
                >
                  <Icon icon={option.icon} twStyles="h-6 w-6" />
                  <span className="ui_caption text-center">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </fieldset>
        <Button
          ariaLabel="Create dashboard"
          disabled={isSaving}
          twStyles="ui_button_text rounded-[5px] border border-border px-3 py-2 text-text-soft transition-colors hover:border-text-soft hover:text-text md:min-h-20"
          onClick={createDashboard}
        >
          {isSaving ? 'Creating' : 'Create dashboard'}
        </Button>
      </div>
    </section>
  );
}

function DashboardHomeButton({
  dashboard,
  isSaving,
  onRequestHomeDashboard,
}: {
  dashboard: DashboardLibraryItem;
  isSaving: boolean;
  onRequestHomeDashboard: (dashboard: DashboardLibraryItem) => void;
}) {
  const label = dashboard.isHome
    ? `${dashboard.title} is home dashboard`
    : `Set ${dashboard.title} as home dashboard`;
  const activeClass = dashboard.isHome
    ? 'border-success text-success'
    : 'border-border text-text-soft hover:border-text-soft hover:text-text';

  return (
    <Button
      ariaLabel={label}
      aria-pressed={dashboard.isHome}
      disabled={isSaving || dashboard.isHome}
      title={label}
      twStyles={`grid h-10 w-10 shrink-0 place-items-center rounded-[5px] border transition-colors ${activeClass}`}
      onClick={() => onRequestHomeDashboard(dashboard)}
    >
      <Icon icon="home" twStyles="h-5 w-5" />
    </Button>
  );
}

function DashboardHomeConfirmationDialog({
  dashboard,
  dashboardOrderUids,
  pinnedDashboardUids,
  onCancel,
  onSaved,
  setItems,
  setSavingDashboardUid,
}: {
  dashboard: DashboardLibraryItem;
  dashboardOrderUids: string[];
  pinnedDashboardUids: string[];
  onCancel: () => void;
  onSaved: () => void;
  setItems: Dispatch<SetStateAction<DashboardLibraryItem[]>>;
  setSavingDashboardUid: (dashboardUid: string | null) => void;
}) {
  const router = useRouter();
  const { notifySuccess, notifyError } = useNotifications();

  async function saveHomeDashboard() {
    setSavingDashboardUid(dashboard.uid);

    try {
      const response = await fetch('/api/dashboard/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          homeDashboardUid: dashboard.uid,
          pinnedDashboardUids,
          dashboardOrderUids,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard could not be set as home'));
      }

      const payload = await response.json() as {
        preferences?: {
          homeDashboardUid?: string;
          pinnedDashboardUids?: string[];
          dashboardOrderUids?: string[];
        };
      };
      const savedHomeDashboardUid = payload.preferences?.homeDashboardUid ?? dashboard.uid;
      const savedPinnedDashboardUids = new Set(payload.preferences?.pinnedDashboardUids ?? pinnedDashboardUids);

      setItems((currentItems) => currentItems.map((item) => ({
        ...item,
        isHome: item.uid === savedHomeDashboardUid,
        isPinned: savedPinnedDashboardUids.has(item.uid),
      })));
      notifySuccess('Home dashboard updated');
      router.refresh();
      onSaved();
    } catch (error) {
      notifyError('Dashboard could not be set as home', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingDashboardUid(null);
    }
  }

  return (
    <DialogPanel title="Set home dashboard?">
      <div className="flex flex-col gap-4">
        <p className="body_text text-text-soft">
          Set {dashboard.title} as the home dashboard? Only one dashboard can be home at a time.
        </p>
        <div className="flex justify-end gap-2">
          <SecondaryButton
            aria-label="Cancel home dashboard change"
            onClick={onCancel}
          >
            Cancel
          </SecondaryButton>
          <SecondaryButton
            aria-label={`Set ${dashboard.title} as home dashboard`}
            onClick={saveHomeDashboard}
          >
            Set as home
          </SecondaryButton>
        </div>
      </div>
    </DialogPanel>
  );
}

function DashboardPinButton({
  dashboard,
  homeDashboardUid,
  pinnedDashboardUids,
  dashboardOrderUids,
  isSaving,
  setSavingDashboardUid,
  setItems,
}: {
  dashboard: DashboardLibraryItem;
  homeDashboardUid: string;
  pinnedDashboardUids: string[];
  dashboardOrderUids: string[];
  isSaving: boolean;
  setSavingDashboardUid: (dashboardUid: string | null) => void;
  setItems: Dispatch<SetStateAction<DashboardLibraryItem[]>>;
}) {
  const router = useRouter();
  const { notifySuccess, notifyError } = useNotifications();

  async function savePinnedState(isPinned: boolean) {
    const nextPinnedDashboardUids = isPinned
      ? [...pinnedDashboardUids, dashboard.uid]
      : pinnedDashboardUids.filter((dashboardUid) => dashboardUid !== dashboard.uid);
    const successTitle = isPinned ? 'Dashboard pinned' : 'Dashboard unpinned';
    const errorTitle = isPinned ? 'Dashboard could not be pinned' : 'Dashboard could not be unpinned';

    setSavingDashboardUid(dashboard.uid);

    try {
      const response = await fetch('/api/dashboard/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          homeDashboardUid,
          pinnedDashboardUids: nextPinnedDashboardUids,
          dashboardOrderUids,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, errorTitle));
      }

      const payload = await response.json() as {
        preferences?: {
          pinnedDashboardUids?: string[];
          dashboardOrderUids?: string[];
        };
      };
      const savedPinnedDashboardUids = new Set(payload.preferences?.pinnedDashboardUids ?? nextPinnedDashboardUids);
      setItems((currentItems) => currentItems.map((item) => ({
        ...item,
        isPinned: savedPinnedDashboardUids.has(item.uid),
      })));
      notifySuccess(successTitle);
      router.refresh();
    } catch (error) {
      notifyError(errorTitle, {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingDashboardUid(null);
    }
  }

  return (
    <Button
      ariaLabel={`${dashboard.isPinned ? 'Unpin' : 'Pin'} ${dashboard.title}`}
      disabled={isSaving}
      title={`${dashboard.isPinned ? 'Unpin' : 'Pin'} ${dashboard.title}`}
      twStyles="grid h-10 w-10 shrink-0 place-items-center rounded-[5px] border border-border text-text-soft transition-colors hover:border-text-soft hover:text-text"
      onClick={() => savePinnedState(!dashboard.isPinned)}
    >
      <Icon icon={dashboard.isPinned ? 'bookmark-filled' : 'bookmark'} twStyles="h-5 w-5" />
    </Button>
  );
}
