'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import { DashboardLibraryView } from '@ui/compositions/DashboardLibrary/DashboardLibraryView';
import {
  getDashboardPreferencePayload,
  moveDashboardItem,
  orderDashboardItems,
  reorderDashboardItems,
} from '@ui/compositions/DashboardLibrary/utils';
import { DASHBOARD_SETTINGS_PARAM } from './const';
import type {
  DashboardDropTarget,
  DashboardLibraryProps,
  DashboardRowMotion,
  PendingDirtyAction,
} from './types';
import {
  dispatchDashboardOrderUpdated,
  getDashboardRowStyle,
  readErrorMessage,
  runDashboardOrderTransition,
} from './utils';

export const DashboardLibrary = ({ dashboards, isOwner }: DashboardLibraryProps) => {
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

  const updateSettingsUrl = (dashboardUid: string | null, navigationMode: 'push' | 'replace' = 'push') => {
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
  };

  const setExpandedSettingsDashboardUid = (
    dashboardUid: string | null,
    navigationMode: 'push' | 'replace' = 'push',
  ) => {
    setExpandedDashboardUid(dashboardUid);
    updateSettingsUrl(dashboardUid, navigationMode);
  };

  const requestSettingsToggle = (dashboardUid: string) => {
    const nextAction: PendingDirtyAction = expandedDashboardUid === dashboardUid
      ? { type: 'collapse' }
      : { type: 'expand', dashboardUid };

    if (isOwner && dirtyDashboardUid) {
      setPendingDirtyAction(nextAction);
      return;
    }

    setExpandedSettingsDashboardUid(nextAction.type === 'expand' ? nextAction.dashboardUid : null);
  };

  const handleDashboardLinkClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!isOwner || !dirtyDashboardUid) {
      return;
    }

    event.preventDefault();
    setPendingDirtyAction({ type: 'navigate', href });
  };

  const handleDiscardSettingsChanges = () => {
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
  };

  const handleDashboardDragStart = (event: DragEvent<HTMLButtonElement>, dashboardUid: string) => {
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
  };

  const getDashboardDropTargetFromPoint = (clientY: number): DashboardDropTarget | null => {
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
  };

  const handleDashboardListDragOver = (event: DragEvent<HTMLUListElement>) => {
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
  };

  const handleDashboardListDragLeave = (event: DragEvent<HTMLUListElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setDropTarget(null);
  };

  const handleDashboardDragEnd = () => {
    draggedDashboardUidRef.current = null;
    setDraggedDashboardUid(null);
    setDropTarget(null);
  };

  const handleDashboardListDrop = (event: DragEvent<HTMLUListElement>) => {
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
  };

  const handleDashboardGrabberKeyDown = (event: KeyboardEvent<HTMLButtonElement>, dashboardUid: string) => {
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
  };

  const handleRowRef = (dashboardUid: string, node: HTMLLIElement | null) => {
    if (node) {
      dashboardRowRefs.current.set(dashboardUid, node);
    } else {
      dashboardRowRefs.current.delete(dashboardUid);
    }
  };

  const handleSettledAnimationEnd = (dashboardUid: string) => {
    setSettledDashboardUid((currentUid) => currentUid === dashboardUid ? null : currentUid);
  };

  const handleMetadataDeleted = (dashboardUid: string) => {
    setExpandedDashboardUid((currentUid) => {
      if (currentUid !== dashboardUid) {
        return currentUid;
      }

      updateSettingsUrl(null, 'replace');
      return null;
    });
    setDirtyDashboardUid((currentUid) => currentUid === dashboardUid ? null : currentUid);
  };

  const handleMetadataSaved = (previousUid: string, nextUid: string) => {
    setExpandedDashboardUid((currentUid) => {
      if (currentUid !== previousUid) {
        return currentUid;
      }

      updateSettingsUrl(nextUid, 'replace');
      return nextUid;
    });
    setDirtyDashboardUid((currentUid) => currentUid === previousUid ? null : currentUid);
  };

  const rowStyle = (dashboardUid: string) => getDashboardRowStyle(dashboardUid, rowMotion[dashboardUid]);

  return (
    <DashboardLibraryView
      items={items}
      isOwner={isOwner}
      expandedDashboardUid={expandedDashboardUid}
      savingDashboardUid={savingDashboardUid}
      draggedDashboardUid={draggedDashboardUid}
      settledDashboardUid={settledDashboardUid}
      dropTarget={dropTarget}
      isSavingOrder={isSavingOrder}
      homeDashboardUid={homeDashboardUid}
      pinnedDashboardUids={pinnedDashboardUids}
      dashboardOrderUids={dashboardOrderUids}
      pendingDirtyAction={pendingDirtyAction}
      pendingHomeDashboard={pendingHomeDashboard}
      rowStyle={rowStyle}
      onRowRef={handleRowRef}
      onSettledAnimationEnd={handleSettledAnimationEnd}
      onSettingsToggle={requestSettingsToggle}
      onDashboardLinkClick={handleDashboardLinkClick}
      onDragStart={handleDashboardDragStart}
      onDragEnd={handleDashboardDragEnd}
      onGrabberKeyDown={handleDashboardGrabberKeyDown}
      onListDragOver={handleDashboardListDragOver}
      onListDragLeave={handleDashboardListDragLeave}
      onListDrop={handleDashboardListDrop}
      onDiscardSettingsChanges={handleDiscardSettingsChanges}
      onKeepEditing={() => setPendingDirtyAction(null)}
      onRequestHomeDashboard={setPendingHomeDashboard}
      onHomeDashboardCancel={() => setPendingHomeDashboard(null)}
      onHomeDashboardSaved={() => setPendingHomeDashboard(null)}
      onDirtyChange={handleDirtyChange}
      onMetadataDeleted={handleMetadataDeleted}
      onMetadataSaved={handleMetadataSaved}
      setSavingDashboardUid={setSavingDashboardUid}
      setItems={setItems}
    />
  );
};
