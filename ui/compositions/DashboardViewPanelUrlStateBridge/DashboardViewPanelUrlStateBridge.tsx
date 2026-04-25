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
  const resolvedViewedPanelId = nextViewedPanelId
    ? allowedPanelIds.includes(nextViewedPanelId)
      ? nextViewedPanelId
      : panelIdAliases[nextViewedPanelId] ?? null
    : null;
  const viewedPanelId = resolvedViewedPanelId && allowedPanelIds.includes(resolvedViewedPanelId)
    ? resolvedViewedPanelId
    : null;
  const [localViewedPanelId, setLocalViewedPanelId] = useState<string | null>(viewedPanelId);

  useEffect(() => {
    setLocalViewedPanelId(viewedPanelId);
  }, [viewedPanelId]);

  useEffect(() => {
    if (!nextViewedPanelId) {
      lastInvalidSearchRef.current = null;
      return;
    }

    const currentSearch = searchParams.toString();
    const nextParams = new URLSearchParams(currentSearch);

    if (viewedPanelId) {
      if (nextViewedPanelId !== viewedPanelId) {
        nextParams.set('viewPanel', viewedPanelId);
        const nextSearch = nextParams.toString();
        const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;
        window.history.replaceState(null, '', nextHref);
      }

      lastInvalidSearchRef.current = null;
      return;
    }

    nextParams.delete('viewPanel');
    const nextSearch = nextParams.toString();
    const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;

    window.history.replaceState(null, '', nextHref);

    if (dashboardTitle && lastInvalidSearchRef.current !== currentSearch) {
      notifyInvalidDashboardUrl(dashboardTitle);
      lastInvalidSearchRef.current = currentSearch;
    }
  }, [dashboardTitle, nextViewedPanelId, notifyInvalidDashboardUrl, pathname, searchParams, viewedPanelId]);

  function onViewedPanelChange(panelId: string | null, navigationMode: 'push' | 'replace' = 'replace') {
    const nextParams = new URLSearchParams(searchParams.toString());
    setLocalViewedPanelId(panelId);

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

  return children({ viewedPanelId: localViewedPanelId, onViewedPanelChange });
}
