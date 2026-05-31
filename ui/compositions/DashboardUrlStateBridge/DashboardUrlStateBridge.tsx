'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDashboardNotifications } from '@ui/compositions/DashboardDefinitionRenderer/useDashboardNotifications';

interface DashboardUrlStateBridgeProps {
  dashboardTitle: string;
  dashboardUid: string;
  rejectTimeRange?: boolean;
}

const hasTimeRangeParams = (searchParams: URLSearchParams): boolean => {
  return Boolean(
    searchParams.get('from') ||
    searchParams.get('to') ||
    searchParams.get('timezone'),
  );
};

export const DashboardUrlStateBridge = ({
  dashboardTitle,
  dashboardUid,
  rejectTimeRange = false,
}: DashboardUrlStateBridgeProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastInvalidSearchRef = useRef<string | null>(null);
  const { notifyInvalidDashboardUrl } = useDashboardNotifications({ dashboardUid });

  useEffect(() => {
    if (!rejectTimeRange || !hasTimeRangeParams(searchParams)) {
      lastInvalidSearchRef.current = null;
      return;
    }

    const currentSearch = searchParams.toString();
    const nextParams = new URLSearchParams(currentSearch);
    nextParams.delete('from');
    nextParams.delete('to');
    nextParams.delete('timezone');
    const nextSearch = nextParams.toString();
    const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;

    router.replace(nextHref);

    if (lastInvalidSearchRef.current !== currentSearch) {
      notifyInvalidDashboardUrl(dashboardTitle);
      lastInvalidSearchRef.current = currentSearch;
    }
  }, [dashboardTitle, notifyInvalidDashboardUrl, pathname, rejectTimeRange, router, searchParams]);

  return null;
};
