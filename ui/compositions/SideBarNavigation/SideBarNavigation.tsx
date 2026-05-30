'use client';

import { useEffect, useSyncExternalStore } from 'react';
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
import {
  readDashboardsExpandedSnapshot,
  readSidebarCollapsedSnapshot,
  setDashboardsExpandedPreference,
  setSidebarCollapsedPreference,
  subscribeToDashboardsExpandedPreference,
  subscribeToSidebarPreference,
} from './utils';

export type {
  PinnedDashboardNavigationItem,
  SidebarCallToAction,
  SideBarNavigationProps,
  SidebarUser,
} from './types';

export const SideBarNavigation = ({
  isOwner = false,
  pinnedDashboards = [],
  homeDashboardUid,
  currentUser,
  callsToAction = DEFAULT_CALLS_TO_ACTION,
}: SideBarNavigationProps) => {
  const pathname = usePathname();
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    readSidebarCollapsedSnapshot,
    () => false,
  );
  const user = currentUser ?? { name: isOwner ? 'Admin' : 'Visitor', imageUrl: null };
  const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const labelClassName = twMerge(
    'min-w-0 truncate transition-opacity duration-150 ease-fade',
    isCollapsed ? 'pointer-events-none absolute left-11 right-3 opacity-0' : 'opacity-100',
  );
  const iconLinkClassName = isCollapsed
    ? 'grid min-h-10 grid-cols-[20px] justify-start gap-0 px-3 py-2.5'
    : 'grid min-h-10 grid-cols-[20px_minmax(0,1fr)] px-3 py-2.5';
  const dashboardsExpanded = useSyncExternalStore(
    subscribeToDashboardsExpandedPreference,
    readDashboardsExpandedSnapshot,
    () => true,
  );
  const dashboardsActive = pathname === '/dashboards';

  useEffect(() => {
    document.documentElement.style.setProperty('--dashboard-sidebar-width', sidebarWidth);
  }, [sidebarWidth]);

  return (
    <nav
      className={twMerge(
        'fixed left-0 top-0 hidden h-screen flex-col border-r border-border p-4 transition-[width] duration-200 md:flex',
        isCollapsed ? 'w-[76px] items-center' : 'w-[270px]',
      )}
      aria-label="Sidebar navigation"
      data-sidebar-state={isCollapsed ? 'collapsed' : 'expanded'}
      data-sidebar-text-state={isCollapsed ? 'collapsed' : 'expanded'}
    >
      <div className="flex h-16 w-full items-center justify-center">
        <Link
          href={homeDashboardUid ? `/dashboards/${homeDashboardUid}` : '/dashboards'}
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
                'ui_nav_text relative grid min-h-10 w-full grid-cols-[20px_minmax(0,1fr)] items-center gap-3 rounded-[4px] px-3 py-2.5 text-nav-link-text transition-colors hover:bg-nav-link-bg-hover hover:text-nav-link-text-hover',
                dashboardsActive && 'bg-nav-link-bg-hover text-nav-link-text-hover',
                isCollapsed && 'grid-cols-[20px] gap-0',
              )}
            >
              <Icon icon="home" twStyles="h-5 w-5" />
              <span className={labelClassName}>Dashboards</span>
            </Link>
            {!isCollapsed ? (
              <Button
                ariaLabel={dashboardsExpanded ? 'Collapse dashboards list' : 'Expand dashboards list'}
                aria-expanded={dashboardsExpanded}
                onClick={() => setDashboardsExpandedPreference(!dashboardsExpanded)}
                twStyles="grid h-10 w-10 place-items-center rounded-[4px] text-nav-link-text transition-colors hover:bg-nav-link-bg-hover hover:text-nav-link-text-hover"
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
              'grid overflow-hidden transition-[grid-template-rows,margin-top] duration-200 ease-out',
              dashboardsExpanded ? 'mt-1 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]',
            )}
            data-dashboards-accordion-state={dashboardsExpanded ? 'expanded' : 'collapsed'}
          >
            <div className="min-h-0 overflow-hidden">
              <ul
                aria-label="Pinned dashboards"
                className={twMerge(
                  'relative grid gap-0.5 transition-[margin-left,padding-left] duration-200 ease-out before:absolute before:bottom-2 before:top-2 before:w-px before:bg-border before:content-[\'\']',
                  isCollapsed
                    ? 'before:left-0'
                    : 'ml-[21px] pl-6 before:left-0',
                )}
              >
                {pinnedDashboards.map((dashboard) => (
                  <li key={dashboard.uid}>
                    <Link
                      href={`/dashboards/${dashboard.uid}`}
                      aria-label={isCollapsed ? dashboard.title : undefined}
                      tabIndex={dashboardsExpanded ? undefined : -1}
                      title={isCollapsed ? dashboard.title : undefined}
                      className={twMerge(
                        'body_text relative min-h-10 rounded-[4px] py-2 text-text-soft transition-colors hover:bg-nav-link-bg-hover hover:text-text',
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
              )}>
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
            onClick={() => setSidebarCollapsedPreference(!isCollapsed)}
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
  );
};

