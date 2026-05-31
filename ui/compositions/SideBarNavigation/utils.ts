import {
  DASHBOARDS_EXPANDED_COOKIE,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_COLLAPSED_COOKIE,
} from './const';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const writePreferenceCookie = (name: string, value: boolean): void => {
  document.cookie = [
    `${name}=${String(value)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ');
};

export const applySidebarCollapsedDocumentState = (collapsed: boolean): void => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.sidebarCollapsed = collapsed ? 'true' : 'false';
  document.documentElement.style.setProperty(
    '--dashboard-sidebar-width',
    collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
  );
};

export const setSidebarCollapsedPreference = (collapsed: boolean): void => {
  writePreferenceCookie(SIDEBAR_COLLAPSED_COOKIE, collapsed);
  applySidebarCollapsedDocumentState(collapsed);
};

export const setDashboardsExpandedPreference = (expanded: boolean): void => {
  writePreferenceCookie(DASHBOARDS_EXPANDED_COOKIE, expanded);
};
