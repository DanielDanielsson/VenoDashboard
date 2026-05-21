'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDashboardNotifications } from '@ui/compositions/DashboardDefinitionRenderer/useDashboardNotifications';

interface DashboardViewPanelUrlStateBridgeProps {
  allowedPanelIds: string[];
  panelIdAliases?: Record<string, string>;
  dashboardTitle?: string;
  dashboardUid?: string;
  children: (input: {
    viewedPanelId: string | null;
    onViewedPanelChange: (panelId: string | null, navigationMode?: 'push' | 'replace') => void;
    editedPanelId: string | null;
    onEditedPanelChange: (panelId: string | null, navigationMode?: 'push' | 'replace') => void;
  }) => ReactNode;
}

export function DashboardViewPanelUrlStateBridge({
  allowedPanelIds,
  panelIdAliases = {},
  dashboardTitle,
  dashboardUid = 'overview',
  children,
}: DashboardViewPanelUrlStateBridgeProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastInvalidSearchRef = useRef<string | null>(null);
  const { notifyInvalidDashboardUrl } = useDashboardNotifications({ dashboardUid });
  const nextViewedPanelId = searchParams.get('viewPanel');
  const nextEditedPanelId = searchParams.get('editPanel');
  const resolvedViewedPanelId = nextViewedPanelId
    ? allowedPanelIds.includes(nextViewedPanelId)
      ? nextViewedPanelId
      : panelIdAliases[nextViewedPanelId] ?? null
    : null;
  const viewedPanelId = resolvedViewedPanelId && allowedPanelIds.includes(resolvedViewedPanelId)
    ? resolvedViewedPanelId
    : null;
  const resolvedEditedPanelId = nextEditedPanelId
    ? allowedPanelIds.includes(nextEditedPanelId)
      ? nextEditedPanelId
      : panelIdAliases[nextEditedPanelId] ?? null
    : null;
  const editedPanelId = resolvedEditedPanelId && allowedPanelIds.includes(resolvedEditedPanelId)
    ? resolvedEditedPanelId
    : null;
  const [localViewedPanelId, setLocalViewedPanelId] = useState<string | null>(editedPanelId ? null : viewedPanelId);
  const [localEditedPanelId, setLocalEditedPanelId] = useState<string | null>(editedPanelId);

  useEffect(() => {
    setLocalEditedPanelId(editedPanelId);
  }, [editedPanelId]);

  useEffect(() => {
    setLocalViewedPanelId(editedPanelId ? null : viewedPanelId);
  }, [editedPanelId, viewedPanelId]);

  useEffect(() => {
    if (!nextViewedPanelId && !nextEditedPanelId) {
      lastInvalidSearchRef.current = null;
      return;
    }

    const currentSearch = searchParams.toString();
    const nextParams = new URLSearchParams(currentSearch);
    let didChangeParams = false;
    let didRejectParams = false;

    if (nextEditedPanelId) {
      if (editedPanelId) {
        if (nextEditedPanelId !== editedPanelId) {
          nextParams.set('editPanel', editedPanelId);
          didChangeParams = true;
        }

        if (nextParams.has('viewPanel')) {
          nextParams.delete('viewPanel');
          didChangeParams = true;
        }

        if (didChangeParams) {
          const nextSearch = nextParams.toString();
          const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;
          window.history.replaceState(null, '', nextHref);
        }

        lastInvalidSearchRef.current = null;
        return;
      }

      nextParams.delete('editPanel');
      didChangeParams = true;
      didRejectParams = true;
    }

    if (viewedPanelId) {
      if (nextViewedPanelId !== viewedPanelId) {
        nextParams.set('viewPanel', viewedPanelId);
        didChangeParams = true;
      }

      if (didChangeParams) {
        const nextSearch = nextParams.toString();
        const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;
        window.history.replaceState(null, '', nextHref);
      }

      if (didRejectParams && dashboardTitle && lastInvalidSearchRef.current !== currentSearch) {
        notifyInvalidDashboardUrl(dashboardTitle);
        lastInvalidSearchRef.current = currentSearch;
        return;
      }

      lastInvalidSearchRef.current = null;
      return;
    }

    if (nextViewedPanelId) {
      nextParams.delete('viewPanel');
      didChangeParams = true;
      didRejectParams = true;
    }

    if (didChangeParams) {
      const nextSearch = nextParams.toString();
      const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;

      window.history.replaceState(null, '', nextHref);
    }

    if (didRejectParams && dashboardTitle && lastInvalidSearchRef.current !== currentSearch) {
      notifyInvalidDashboardUrl(dashboardTitle);
      lastInvalidSearchRef.current = currentSearch;
    }
  }, [
    dashboardTitle,
    editedPanelId,
    nextEditedPanelId,
    nextViewedPanelId,
    notifyInvalidDashboardUrl,
    pathname,
    searchParams,
    viewedPanelId,
  ]);

  function onViewedPanelChange(panelId: string | null, navigationMode: 'push' | 'replace' = 'replace') {
    const nextParams = new URLSearchParams(searchParams.toString());
    setLocalEditedPanelId(null);
    setLocalViewedPanelId(panelId);
    nextParams.delete('editPanel');

    if (panelId) {
      nextParams.set('viewPanel', panelId);
    } else {
      nextParams.delete('viewPanel');
    }

    const nextSearch = nextParams.toString();
    const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;

    if (navigationMode === 'push') {
      window.history.pushState(null, '', nextHref);
      return;
    }

    window.history.replaceState(null, '', nextHref);
  }

  function onEditedPanelChange(panelId: string | null, navigationMode: 'push' | 'replace' = 'replace') {
    const nextParams = new URLSearchParams(searchParams.toString());
    setLocalViewedPanelId(null);
    setLocalEditedPanelId(panelId);
    nextParams.delete('viewPanel');

    if (panelId) {
      nextParams.set('editPanel', panelId);
    } else {
      nextParams.delete('editPanel');
    }

    const nextSearch = nextParams.toString();
    const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;

    if (navigationMode === 'push') {
      window.history.pushState(null, '', nextHref);
      return;
    }

    window.history.replaceState(null, '', nextHref);
  }

  return children({
    viewedPanelId: localEditedPanelId ?? localViewedPanelId,
    onViewedPanelChange,
    editedPanelId: localEditedPanelId,
    onEditedPanelChange,
  });
}
