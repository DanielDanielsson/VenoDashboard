'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import { Button } from '../../base/Button';
import { Icon } from '../../base/Icon';
import type { IconName } from '../../base/Icon';
import { NavigationLink } from '../../components/NavigationLink';
import { ThemeToggle } from '../../components/ThemeToggle';

const SIDEBAR_STORAGE_KEY = 'veno-sidebar-collapsed';
const SIDEBAR_EVENT = 'veno-sidebar-collapsed-change';
const SIDEBAR_WIDTH_EXPANDED = '270px';
const SIDEBAR_WIDTH_COLLAPSED = '76px';
const AVATAR_PLACEHOLDER_SRC = '/static_assets/avatar-placeholder.svg';
const FEEDBACK_FORM_URL = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL?.trim();

const DASHBOARD_LINKS: ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName;
  ownerOnly?: boolean;
}> = [
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings', ownerOnly: true },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: 'key', ownerOnly: true },
];

const SECONDARY_LINKS: ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName;
  external?: boolean;
}> = [
  { href: '/dashboard/about', label: 'About', icon: 'info' },
  {
    href: 'https://github.com/DanielDanielsson/VenoDashboard',
    label: 'GitHub',
    icon: 'github',
    external: true,
  },
];

const DEFAULT_CALLS_TO_ACTION: ReadonlyArray<SidebarCallToAction> = [
  {
    id: 'feedback',
    title: 'Feedback',
    body: 'Tell us what you think about Veno.',
    href: FEEDBACK_FORM_URL || 'mailto:feedback@venoplatform.com?subject=Veno%20Dashboard%20feedback',
    actionLabel: 'Share feedback',
    icon: 'lightbulb',
  },
];

function readSidebarCollapsedSnapshot(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

function subscribeToSidebarPreference(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === SIDEBAR_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(SIDEBAR_EVENT, callback);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(SIDEBAR_EVENT, callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function setSidebarCollapsedPreference(collapsed: boolean): void {
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

export interface PinnedDashboardNavigationItem {
  uid: string;
  title: string;
}

export interface SidebarUser {
  name: string;
  imageUrl?: string | null;
}

export interface SidebarCallToAction {
  id: string;
  title: string;
  body: string;
  href: string;
  actionLabel: string;
  icon?: IconName;
}

export const SideBarNavigation = ({
  isOwner = false,
  pinnedDashboards = [],
  currentUser,
  callsToAction = DEFAULT_CALLS_TO_ACTION,
}: {
  isOwner?: boolean;
  pinnedDashboards?: PinnedDashboardNavigationItem[];
  currentUser?: SidebarUser;
  callsToAction?: ReadonlyArray<SidebarCallToAction>;
}) => {
  const pathname = usePathname();
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    readSidebarCollapsedSnapshot,
    () => false,
  );
  const user = currentUser ?? { name: isOwner ? 'Admin' : 'Visitor', imageUrl: null };
  const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const labelClassName = isCollapsed ? 'sr-only' : 'min-w-0 truncate';
  const iconLinkClassName = isCollapsed
    ? 'grid min-h-10 grid-cols-[20px] justify-start gap-0 px-3 py-2.5'
    : 'grid min-h-10 grid-cols-[20px_minmax(0,1fr)] px-3 py-2.5';
  const [dashboardsExpanded, setDashboardsExpanded] = useState(true);
  const dashboardsActive = pathname === '/dashboards';

  useEffect(() => {
    document.documentElement.style.setProperty('--dashboard-sidebar-width', sidebarWidth);
  }, [sidebarWidth]);

  return (
    <nav
      className={twMerge(
        'fixed left-0 top-0 hidden h-screen flex-col border-r border-nav-link-text/50 p-4 transition-[width] duration-200 md:flex',
        isCollapsed ? 'w-[76px] items-center' : 'w-[270px]',
      )}
      aria-label="Sidebar navigation"
      data-sidebar-state={isCollapsed ? 'collapsed' : 'expanded'}
    >
      <div className="flex h-16 w-full items-center justify-center">
        {isCollapsed ? (
          <Icon
            icon="veno-glucose-indicator"
            title="Veno"
            twStyles="h-8 w-8 text-text"
          />
        ) : (
          <span className="flex items-center justify-center gap-2 text-text" aria-label="Veno" role="img">
            <Icon icon="veno-wordmark" twStyles="h-[64px] w-[94px]" />
            <Icon icon="veno-glucose-indicator" twStyles="h-8 w-8" />
          </span>
        )}
        <Button
          ariaLabel={isCollapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
          aria-expanded={!isCollapsed}
          onClick={() => setSidebarCollapsedPreference(!isCollapsed)}
          twStyles="absolute right-0 top-8 grid h-9 w-9 translate-x-1/2 place-items-center rounded-full border border-border bg-bg text-text-soft shadow-sm transition-colors hover:border-border-hover hover:bg-nav-link-bg hover:text-text"
          title={isCollapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
        >
          <Icon icon={isCollapsed ? 'sidebar-expand' : 'sidebar-collapse'} twStyles="h-5 w-5" />
        </Button>
      </div>

      <ul className="mt-6 flex w-full flex-col gap-1">
        <li className="w-full">
          <div className="grid w-full grid-cols-[1fr_auto] items-center gap-0.5">
            <Link
              href="/dashboards"
              aria-label="Dashboards"
              title={isCollapsed ? 'Dashboards' : undefined}
              className={twMerge(
                'ui_nav_text grid min-h-10 w-full grid-cols-[20px_minmax(0,1fr)] items-center gap-3 rounded-[4px] px-3 py-2.5 text-nav-link-text transition-colors hover:bg-nav-link-bg-hover hover:text-nav-link-text-hover',
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
                onClick={() => setDashboardsExpanded((current) => !current)}
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
          {dashboardsExpanded ? (
            <ul
              aria-label="Pinned dashboards"
              className={twMerge(
                'relative mt-1 grid gap-0.5 before:absolute before:bottom-2 before:top-2 before:w-px before:bg-border before:content-[\'\']',
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
                    title={isCollapsed ? dashboard.title : undefined}
                    className={twMerge(
                      'body_text min-h-10 rounded-[4px] py-2 text-text-soft transition-colors hover:bg-nav-link-bg-hover hover:text-text',
                      pathname === `/dashboards/${dashboard.uid}` && 'bg-nav-link-bg-hover text-text',
                      isCollapsed
                        ? 'grid grid-cols-[20px] items-center gap-0 px-3'
                        : 'grid grid-cols-[20px_minmax(0,1fr)] items-center gap-3 px-3',
                    )}
                  >
                    <Icon icon="dashboard-grid" twStyles="h-5 w-5" />
                    <span className={labelClassName}>{dashboard.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
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
                {!isCollapsed ? <span className="ui_micro_label text-nav-link-text/35">Admin</span> : null}
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
                'body_text grid min-h-10 grid-cols-[20px_minmax(0,1fr)] items-center gap-3 rounded-[4px] px-3 py-2 text-text-soft transition-colors hover:bg-nav-link-bg-hover hover:text-text',
                isCollapsed && 'grid-cols-[20px] gap-0',
              )}
            >
              <Icon icon={link.icon} twStyles="h-5 w-5" />
              <span className={labelClassName}>{link.label}</span>
            </Link>
          </li>
        ))}
        {!isOwner ? (
          <li className="w-full">
            <Link
              href="/login"
              aria-label={isCollapsed ? 'Admin sign in' : undefined}
              title={isCollapsed ? 'Admin sign in' : undefined}
              className={twMerge(
                'body_text grid min-h-10 grid-cols-[20px_minmax(0,1fr)] items-center gap-3 rounded-[4px] px-3 py-2 text-text-soft transition-colors hover:bg-nav-link-bg-hover hover:text-text',
                isCollapsed && 'grid-cols-[20px] gap-0',
              )}
            >
              <Icon icon="key" twStyles="h-5 w-5" />
              <span className={labelClassName}>Admin sign in</span>
            </Link>
          </li>
        ) : null}
        <li className="grid min-h-10 w-full grid-cols-[20px_minmax(0,1fr)] items-center px-3">
          <span className="grid h-5 w-5 -translate-x-[7px] -translate-y-[7px] place-items-center">
            <ThemeToggle />
          </span>
        </li>
      </ul>

      <div className={twMerge('mt-auto flex w-full flex-col gap-3', isCollapsed && 'items-center')}>
        {callsToAction.map((callToAction) => (
          <SidebarCallToActionCard key={callToAction.id} callToAction={callToAction} collapsed={isCollapsed} />
        ))}
        <SidebarUserCard user={user} isOwner={isOwner} collapsed={isCollapsed} />
      </div>
    </nav>
  );
};

function SidebarCallToActionCard({
  callToAction,
  collapsed,
}: {
  callToAction: SidebarCallToAction;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <Link
        href={callToAction.href}
        aria-label={callToAction.actionLabel}
        title={callToAction.actionLabel}
        className="grid h-10 w-10 place-items-center rounded-[4px] border border-border bg-surface-strong text-text-soft transition-colors hover:border-border-hover hover:text-accent"
      >
        <Icon icon={callToAction.icon ?? 'info'} twStyles="h-5 w-5" />
      </Link>
    );
  }

  return (
    <aside className="rounded-[4px] border border-border bg-surface-strong p-3 text-text shadow-sm" aria-label={callToAction.title}>
      <div className="flex items-start gap-2">
        <Icon icon={callToAction.icon ?? 'info'} twStyles="mt-0.5 h-5 w-5 text-accent" />
        <div className="min-w-0">
          <p className="body_text_emphasis truncate">{callToAction.title}</p>
          <p className="ui_caption mt-1 text-text-soft">{callToAction.body}</p>
        </div>
      </div>
      <Link
        href={callToAction.href}
        className="ui_caption_strong mt-3 flex justify-center rounded-[4px] bg-accent px-3 py-2 text-bg transition-colors hover:bg-accent-strong"
      >
        {callToAction.actionLabel}
      </Link>
    </aside>
  );
}

function SidebarUserCard({
  user,
  isOwner,
  collapsed,
}: {
  user: SidebarUser;
  isOwner: boolean;
  collapsed: boolean;
}) {
  const imageSrc = user.imageUrl || AVATAR_PLACEHOLDER_SRC;
  const settingsHref = isOwner ? '/dashboard/settings' : '/login';
  const settingsLabel = isOwner ? 'Open settings' : 'Sign in for settings';

  return (
    <div className={twMerge(
      'flex w-full items-center gap-3 border-t border-border pt-3 text-text',
      collapsed && 'flex-col gap-2',
    )}>
      <img
        src={imageSrc}
        alt=""
        className="h-9 w-9 rounded-lg border border-border bg-surface object-cover"
      />
      {!collapsed ? (
        <p className="body_text_strong min-w-0 flex-1 truncate">{user.name || 'Visitor'}</p>
      ) : (
        <span className="sr-only">{user.name || 'Visitor'}</span>
      )}
      <Link
        href={settingsHref}
        aria-label={settingsLabel}
        title={settingsLabel}
        className="grid h-8 w-8 place-items-center rounded text-text-soft transition-colors hover:bg-nav-link-bg hover:text-text"
      >
        <Icon icon="settings" twStyles="h-5 w-5" />
      </Link>
    </div>
  );
}
