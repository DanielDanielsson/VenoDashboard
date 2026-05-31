'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import { Button } from '../../base/Button';
import { Icon } from '../../base/Icon';
import { NavigationLink } from '../../components/NavigationLink';
import { ThemeToggle } from '../../components/ThemeToggle';
import {
  DASHBOARD_LINKS,
  DEFAULT_CALLS_TO_ACTION,
  SECONDARY_LINKS,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from './const';
import { SidebarCallToActionCard } from './SidebarCallToActionCard';
import { SidebarUserCard } from './SidebarUserCard';
import type { SideBarNavigationProps } from './types';
import type { PinnedDashboardNavigationItem } from './types';
import {
  applySidebarCollapsedDocumentState,
  setDashboardsExpandedPreference,
  setSidebarCollapsedPreference,
} from './utils';

export type {
  PinnedDashboardNavigationItem,
  SidebarCallToAction,
  SideBarNavigationProps,
  SidebarUser,
} from './types';

const DASHBOARD_ORDER_UPDATED_EVENT = 'veno:dashboard-order-updated';
const DASHBOARD_METADATA_UPDATED_EVENT = 'veno:dashboard-metadata-updated';
const DASHBOARD_PREFERENCES_UPDATED_EVENT = 'veno:dashboard-preferences-updated';

interface DashboardMetadataUpdatedDetail {
  previousUid?: string;
  dashboard?: {
    uid?: string;
    title?: string;
    icon?: PinnedDashboardNavigationItem['icon'];
  };
  preferences?: {
    homeDashboardUid?: string;
    pinnedDashboardUids?: string[];
  };
}

interface DashboardPreferencesUpdatedDetail {
  homeDashboardUid?: string;
  pinnedDashboardUids?: string[];
  dashboards?: PinnedDashboardNavigationItem[];
}

interface SidebarDashboardMotion {
  offset: number;
  phase: 'offset' | 'animate';
}

const parseDurationMs = (value: string): number => {
  const trimmed = value.trim();

  if (trimmed.endsWith('ms')) {
    return Number.parseFloat(trimmed);
  }

  if (trimmed.endsWith('s')) {
    return Number.parseFloat(trimmed) * 1000;
  }

  return 200;
};

const getSidebarDashboardListGap = (rowRefs: Map<string, HTMLLIElement>): number => {
  const firstRow = rowRefs.values().next().value;
  const rowGap = firstRow?.parentElement
    ? getComputedStyle(firstRow.parentElement).rowGap
    : '0';
  const parsedGap = Number.parseFloat(rowGap);

  return Number.isNaN(parsedGap) ? 0 : parsedGap;
};

const getSidebarDashboardMotion = (
  rowRefs: Map<string, HTMLLIElement>,
  nextDashboardUids: string[],
): Record<string, SidebarDashboardMotion> => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return {};
  }

  const measurements = new Map(
    Array.from(rowRefs.entries()).map(([dashboardUid, row]) => [
      dashboardUid,
      {
        height: row.getBoundingClientRect().height,
        top: row.getBoundingClientRect().top,
      },
    ]),
  );
  const firstTop = Math.min(...Array.from(measurements.values()).map((measurement) => measurement.top));

  if (!Number.isFinite(firstTop)) {
    return {};
  }

  const rowGap = getSidebarDashboardListGap(rowRefs);
  const motion: Record<string, SidebarDashboardMotion> = {};
  let nextTop = firstTop;

  nextDashboardUids.forEach((dashboardUid) => {
    const measurement = measurements.get(dashboardUid);
    if (!measurement) {
      return;
    }

    const offset = measurement.top - nextTop;
    if (Math.abs(offset) >= 1) {
      motion[dashboardUid] = {
        offset,
        phase: 'offset',
      };
    }

    nextTop += measurement.height + rowGap;
  });

  return motion;
};

const getSidebarDashboardStyle = (motion?: SidebarDashboardMotion): CSSProperties | undefined => {
  if (!motion) {
    return undefined;
  }

  return {
    transform: motion.phase === 'offset' ? `translateY(${motion.offset}px)` : 'translateY(0)',
    transition: motion.phase === 'offset'
      ? 'none'
      : 'transform var(--duration-dashboard-order) ease-out',
    zIndex: 1,
  };
};

export const SideBarNavigation = ({
  isOwner = false,
  pinnedDashboards = [],
  homeDashboardUid,
  currentUser,
  callsToAction = DEFAULT_CALLS_TO_ACTION,
  initialCollapsed = false,
  initialDashboardsExpanded = true,
}: SideBarNavigationProps) => {
  const pathname = usePathname();
  const pinnedDashboardRowRefs = useRef(new Map<string, HTMLLIElement>());
  const pinnedDashboardMotionFrameRef = useRef<number | null>(null);
  const pinnedDashboardMotionTimeoutRef = useRef<number | null>(null);
  const [localHomeDashboardUid, setLocalHomeDashboardUid] = useState(homeDashboardUid);
  const [localPinnedDashboards, setLocalPinnedDashboards] = useState(pinnedDashboards);
  const [dashboardOrderUids, setDashboardOrderUids] = useState<string[] | null>(null);
  const [pinnedDashboardMotion, setPinnedDashboardMotion] = useState<Record<string, SidebarDashboardMotion>>({});
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const user = currentUser ?? { name: isOwner ? 'Admin' : 'Visitor', imageUrl: null };
  const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const labelClassName = twMerge(
    'min-w-0 truncate transition-opacity duration-150 ease-fade',
    isCollapsed ? 'pointer-events-none absolute left-11 right-3 opacity-0' : 'opacity-100',
  );
  const iconLinkClassName = isCollapsed
    ? 'grid min-h-10 grid-cols-[20px] justify-start gap-0 px-3 py-2.5'
    : 'grid min-h-10 grid-cols-[20px_minmax(0,1fr)] px-3 py-2.5';
  const [dashboardsExpanded, setDashboardsExpanded] = useState(initialDashboardsExpanded);
  const dashboardsActive = pathname === '/dashboards';
  const displayedPinnedDashboards = useMemo(() => {
    if (!dashboardOrderUids) {
      return localPinnedDashboards;
    }

    const orderIndex = new Map(dashboardOrderUids.map((dashboardUid, index) => [dashboardUid, index]));

    return [...localPinnedDashboards].sort((left, right) => {
      const leftIndex = orderIndex.get(left.uid);
      const rightIndex = orderIndex.get(right.uid);

      if (leftIndex !== undefined || rightIndex !== undefined) {
        if (leftIndex === undefined) {
          return 1;
        }

        if (rightIndex === undefined) {
          return -1;
        }

        return leftIndex - rightIndex;
      }

      return 0;
    });
  }, [dashboardOrderUids, localPinnedDashboards]);

  useEffect(() => {
    setLocalHomeDashboardUid(homeDashboardUid);
  }, [homeDashboardUid]);

  useEffect(() => {
    setLocalPinnedDashboards(pinnedDashboards);
  }, [pinnedDashboards]);

  useLayoutEffect(() => {
    applySidebarCollapsedDocumentState(isCollapsed);
  }, [isCollapsed]);

  useEffect(() => {
    const handleDashboardMetadataUpdated = (event: Event) => {
      const detail = (event as CustomEvent<DashboardMetadataUpdatedDetail>).detail;
      const previousUid = detail?.previousUid;
      const dashboard = detail?.dashboard;
      const nextUid = dashboard?.uid ?? previousUid;

      if (!previousUid || !nextUid || !dashboard) {
        return;
      }

      setLocalHomeDashboardUid((currentUid) => {
        if (detail.preferences?.homeDashboardUid !== undefined) {
          return detail.preferences.homeDashboardUid;
        }

        return currentUid === previousUid ? nextUid : currentUid;
      });

      setLocalPinnedDashboards((currentDashboards) => {
        const updatedDashboards = currentDashboards.map((currentDashboard) => {
          if (currentDashboard.uid !== previousUid && currentDashboard.uid !== nextUid) {
            return currentDashboard;
          }

          return {
            ...currentDashboard,
            uid: nextUid,
            title: dashboard.title ?? currentDashboard.title,
            icon: dashboard.icon ?? currentDashboard.icon,
          };
        });

        const pinnedDashboardUids = detail.preferences?.pinnedDashboardUids;
        if (!pinnedDashboardUids) {
          return updatedDashboards;
        }

        const pinnedUidSet = new Set(pinnedDashboardUids);
        const hasUpdatedDashboard = updatedDashboards.some((currentDashboard) => currentDashboard.uid === nextUid);
        const nextDashboards = pinnedUidSet.has(nextUid) && !hasUpdatedDashboard
          ? [
              ...updatedDashboards,
              {
                uid: nextUid,
                title: dashboard.title ?? nextUid,
                icon: dashboard.icon,
              },
            ]
          : updatedDashboards;

        return nextDashboards.filter((currentDashboard) => pinnedUidSet.has(currentDashboard.uid));
      });
    };

    window.addEventListener(DASHBOARD_METADATA_UPDATED_EVENT, handleDashboardMetadataUpdated);
    return () => window.removeEventListener(DASHBOARD_METADATA_UPDATED_EVENT, handleDashboardMetadataUpdated);
  }, []);

  useEffect(() => {
    const handleDashboardPreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<DashboardPreferencesUpdatedDetail>).detail;

      if (detail.homeDashboardUid !== undefined) {
        setLocalHomeDashboardUid(detail.homeDashboardUid);
      }

      if (detail.pinnedDashboardUids) {
        const pinnedUidSet = new Set(detail.pinnedDashboardUids);
        const eventDashboardByUid = new Map((detail.dashboards ?? []).map((dashboard) => [dashboard.uid, dashboard]));

        setLocalPinnedDashboards((currentDashboards) => {
          const nextDashboards = currentDashboards
            .map((dashboard) => eventDashboardByUid.get(dashboard.uid) ?? dashboard)
            .filter((dashboard) => pinnedUidSet.has(dashboard.uid));
          const nextDashboardUids = new Set(nextDashboards.map((dashboard) => dashboard.uid));

          eventDashboardByUid.forEach((dashboard) => {
            if (pinnedUidSet.has(dashboard.uid) && !nextDashboardUids.has(dashboard.uid)) {
              nextDashboards.push(dashboard);
            }
          });

          return nextDashboards;
        });
      }
    };

    window.addEventListener(DASHBOARD_PREFERENCES_UPDATED_EVENT, handleDashboardPreferencesUpdated);
    return () => window.removeEventListener(DASHBOARD_PREFERENCES_UPDATED_EVENT, handleDashboardPreferencesUpdated);
  }, []);

  useEffect(() => {
    const handleDashboardOrderUpdated = (event: Event) => {
      const nextDashboardOrderUids = (event as CustomEvent<{ dashboardOrderUids?: string[] }>).detail
        ?.dashboardOrderUids;

      if (!Array.isArray(nextDashboardOrderUids)) {
        return;
      }

      const nextPinnedDashboardUids = [...localPinnedDashboards]
        .sort((left, right) => {
          const leftIndex = nextDashboardOrderUids.indexOf(left.uid);
          const rightIndex = nextDashboardOrderUids.indexOf(right.uid);

          if (leftIndex !== -1 || rightIndex !== -1) {
            if (leftIndex === -1) {
              return 1;
            }

            if (rightIndex === -1) {
              return -1;
            }

            return leftIndex - rightIndex;
          }

          return 0;
        })
        .map((dashboard) => dashboard.uid);
      const nextMotion = getSidebarDashboardMotion(pinnedDashboardRowRefs.current, nextPinnedDashboardUids);

      if (pinnedDashboardMotionFrameRef.current !== null) {
        window.cancelAnimationFrame(pinnedDashboardMotionFrameRef.current);
      }
      if (pinnedDashboardMotionTimeoutRef.current !== null) {
        window.clearTimeout(pinnedDashboardMotionTimeoutRef.current);
      }

      setPinnedDashboardMotion(nextMotion);
      setDashboardOrderUids(nextDashboardOrderUids);

      if (Object.keys(nextMotion).length === 0) {
        return;
      }

      pinnedDashboardMotionFrameRef.current = window.requestAnimationFrame(() => {
        setPinnedDashboardMotion((currentMotion) => Object.fromEntries(
          Object.entries(currentMotion).map(([dashboardUid, motion]) => [
            dashboardUid,
            { ...motion, phase: 'animate' },
          ]),
        ));
      });

      const duration = parseDurationMs(
        getComputedStyle(document.documentElement).getPropertyValue('--duration-dashboard-order'),
      );

      pinnedDashboardMotionTimeoutRef.current = window.setTimeout(() => {
        setPinnedDashboardMotion({});
        pinnedDashboardMotionFrameRef.current = null;
        pinnedDashboardMotionTimeoutRef.current = null;
      }, duration + 50);
    };

    window.addEventListener(DASHBOARD_ORDER_UPDATED_EVENT, handleDashboardOrderUpdated);
    return () => window.removeEventListener(DASHBOARD_ORDER_UPDATED_EVENT, handleDashboardOrderUpdated);
  }, [localPinnedDashboards]);

  useEffect(() => () => {
    if (pinnedDashboardMotionFrameRef.current !== null) {
      window.cancelAnimationFrame(pinnedDashboardMotionFrameRef.current);
    }
    if (pinnedDashboardMotionTimeoutRef.current !== null) {
      window.clearTimeout(pinnedDashboardMotionTimeoutRef.current);
    }
  }, []);

  return (
    <>
      <style>
        {`:root { --dashboard-sidebar-width: ${sidebarWidth}; }`}
      </style>
      <nav
        className={twMerge(
          'fixed left-0 top-0 hidden h-screen flex-col border-r border-border p-4 transition-[width] duration-dashboard-order md:flex',
          isCollapsed ? 'w-[76px] items-center' : 'w-[270px]',
        )}
        aria-label="Sidebar navigation"
        data-sidebar-state={isCollapsed ? 'collapsed' : 'expanded'}
        data-sidebar-text-state={isCollapsed ? 'collapsed' : 'expanded'}
      >
      <div className="flex h-16 w-full items-center justify-center">
        <Link
          href={localHomeDashboardUid ? `/dashboards/${localHomeDashboardUid}` : '/dashboards'}
          className="relative flex items-center justify-center gap-2 text-text"
          aria-label="Veno"
        >
          <Icon
            icon="veno-wordmark"
            twStyles={twMerge(
              'h-[64px] w-[94px] transition-[opacity,transform] duration-150 ease-fade',
              isCollapsed ? 'pointer-events-none absolute right-full -translate-x-2 opacity-0' : 'translate-x-0 opacity-100',
            )}
          />
          <Icon icon="veno-glucose-indicator" twStyles="h-8 w-8" />
        </Link>
      </div>

      <ul
        className="mt-3 flex w-full flex-col gap-1 border-t border-border pt-3"
        data-sidebar-primary-nav
      >
        <li className="w-full">
          <div className="grid w-full grid-cols-[1fr_auto] items-center gap-0.5">
            <Link
              href="/dashboards"
              aria-label="Dashboards"
              title={isCollapsed ? 'Dashboards' : undefined}
              className={twMerge(
                'ui_nav_text relative grid min-h-10 w-full grid-cols-[20px_minmax(0,1fr)] items-center gap-3 rounded-[4px] px-3 py-2.5 text-nav-link-text transition-colors duration-dashboard-order hover:bg-nav-link-bg-hover hover:text-nav-link-text-hover',
                dashboardsActive && 'bg-nav-link-bg-hover text-nav-link-text-hover',
                isCollapsed && 'grid-cols-[20px] gap-0',
              )}
            >
              <Icon icon="dashboard-grid" twStyles="h-5 w-5" />
              <span className={labelClassName}>Dashboards</span>
            </Link>
            {!isCollapsed ? (
              <Button
                ariaLabel={dashboardsExpanded ? 'Collapse dashboards list' : 'Expand dashboards list'}
                aria-expanded={dashboardsExpanded}
                onClick={() => {
                  const nextDashboardsExpanded = !dashboardsExpanded;
                  setDashboardsExpanded(nextDashboardsExpanded);
                  setDashboardsExpandedPreference(nextDashboardsExpanded);
                }}
                twStyles="grid h-10 w-10 place-items-center rounded-[4px] text-nav-link-text transition-colors duration-dashboard-order hover:bg-nav-link-bg-hover hover:text-nav-link-text-hover"
                title={dashboardsExpanded ? 'Collapse dashboards list' : 'Expand dashboards list'}
              >
                <Icon
                  icon={dashboardsExpanded ? 'chevron-up' : 'chevron-down'}
                  twStyles="h-4 w-4"
                />
              </Button>
            ) : null}
          </div>
          <div
            aria-hidden={!dashboardsExpanded}
            className={twMerge(
              'grid overflow-hidden transition-[grid-template-rows,margin-top] duration-dashboard-order ease-out',
              dashboardsExpanded ? 'mt-1 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]',
            )}
            data-dashboards-accordion-state={dashboardsExpanded ? 'expanded' : 'collapsed'}
          >
            <div className="min-h-0 overflow-hidden">
              <ul
                aria-label="Pinned dashboards"
                className={twMerge(
                  'relative grid gap-0.5 transition-[margin-left,padding-left] duration-dashboard-order ease-out before:absolute before:bottom-2 before:top-2 before:w-px before:bg-border before:content-[\'\']',
                  isCollapsed
                    ? 'before:left-0'
                    : 'ml-[21px] pl-6 before:left-0',
                )}
              >
                {displayedPinnedDashboards.map((dashboard) => (
                  <li
                    key={dashboard.uid}
                    ref={(node) => {
                      if (node) {
                        pinnedDashboardRowRefs.current.set(dashboard.uid, node);
                        return;
                      }

                      pinnedDashboardRowRefs.current.delete(dashboard.uid);
                    }}
                    className="relative"
                    style={getSidebarDashboardStyle(pinnedDashboardMotion[dashboard.uid])}
                  >
                    <Link
                      href={`/dashboards/${dashboard.uid}`}
                      aria-label={isCollapsed ? dashboard.title : undefined}
                      tabIndex={dashboardsExpanded ? undefined : -1}
                      title={isCollapsed ? dashboard.title : undefined}
                      className={twMerge(
                        'body_text relative min-h-10 rounded-[4px] py-2 text-text-soft transition-colors duration-dashboard-order hover:bg-nav-link-bg-hover hover:text-text',
                        pathname === `/dashboards/${dashboard.uid}` && 'bg-nav-link-bg-hover text-text',
                        isCollapsed
                          ? 'grid grid-cols-[20px] items-center gap-0 px-3'
                          : 'grid grid-cols-[20px_minmax(0,1fr)] items-center gap-3 px-3',
                      )}
                    >
                      <Icon icon={dashboard.icon ?? 'dashboard-grid'} twStyles="h-5 w-5" />
                      <span className={labelClassName}>{dashboard.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </li>
        {DASHBOARD_LINKS.map((link) => {
          if (!link.ownerOnly || isOwner) {
            return (
              <NavigationLink
                key={link.href}
                href={link.href}
                icon={link.icon}
                ariaLabel={isCollapsed ? link.label : undefined}
                title={isCollapsed ? link.label : undefined}
                twStyles={twMerge(iconLinkClassName, isCollapsed && 'grid-cols-[20px]')}
              >
                <span className={labelClassName}>{link.label}</span>
              </NavigationLink>
            );
          }

          return (
            <li
              key={link.href}
              className="relative w-full rounded-[4px]"
            >
              <div className={twMerge(
                'ui_nav_text relative grid min-h-10 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 rounded-[4px] px-3 py-2.5 text-nav-link-text/45',
                isCollapsed && 'grid-cols-[20px] gap-0',
              )}
              >
                <Icon icon={link.icon} twStyles="h-5 w-5" />
                <span className={labelClassName}>{link.label}</span>
                <span
                  className={twMerge(
                    'ui_micro_label text-nav-link-text/35 transition-opacity duration-150 ease-fade',
                    isCollapsed ? 'pointer-events-none absolute right-3 opacity-0' : 'opacity-100',
                  )}
                >
                  Admin
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <ul className="mt-3 flex w-full flex-col gap-0.5 border-t border-border pt-3">
        {SECONDARY_LINKS.map((link) => (
          <li key={link.href} className="w-full">
            <Link
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              aria-label={isCollapsed ? link.label : undefined}
              title={isCollapsed ? link.label : undefined}
              className={twMerge(
                'body_text relative grid min-h-10 grid-cols-[20px_minmax(0,1fr)] items-center gap-3 rounded-[4px] px-3 py-2 text-text-soft transition-colors hover:bg-nav-link-bg-hover hover:text-text',
                isCollapsed && 'grid-cols-[20px] gap-0',
              )}
            >
              <Icon icon={link.icon} twStyles="h-5 w-5" />
              <span className={labelClassName}>{link.label}</span>
            </Link>
          </li>
        ))}
        <li className="w-full">
          <Button
            ariaLabel={isCollapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
            aria-expanded={!isCollapsed}
            onClick={() => {
              const nextCollapsed = !isCollapsed;
              setIsCollapsed(nextCollapsed);
              setSidebarCollapsedPreference(nextCollapsed);
            }}
            twStyles={twMerge(
              'body_text relative grid min-h-10 w-full grid-cols-[20px] items-center gap-0 rounded-[4px] px-3 py-2 text-text-soft transition-colors hover:bg-nav-link-bg-hover hover:text-text',
            )}
            title={isCollapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
          >
            <Icon icon={isCollapsed ? 'sidebar-expand' : 'sidebar-collapse'} twStyles="h-5 w-5" />
          </Button>
        </li>
        <li className="grid min-h-10 w-full grid-cols-[20px_minmax(0,1fr)] items-center px-3">
          <span className="grid h-5 w-5 -translate-x-[7px] -translate-y-[7px] place-items-center">
            <ThemeToggle />
          </span>
        </li>
      </ul>

      <div className={twMerge('mt-auto flex w-full flex-col gap-3', isCollapsed && 'items-center')}>
        {callsToAction.map((callToAction) => (
          <SidebarCallToActionCard
            key={callToAction.id}
            callToAction={callToAction}
            collapsed={isCollapsed}
          />
        ))}
        <SidebarUserCard
          user={user}
          isOwner={isOwner}
          layoutCollapsed={isCollapsed}
          labelClassName={labelClassName}
          showNotificationDot={isCollapsed && callsToAction.length > 0}
        />
      </div>
      </nav>
    </>
  );
};
