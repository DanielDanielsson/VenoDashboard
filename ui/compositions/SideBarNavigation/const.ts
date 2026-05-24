import type { SidebarCallToAction, SidebarDashboardLink, SidebarSecondaryLink } from './types';

export const SIDEBAR_STORAGE_KEY = 'veno-sidebar-collapsed';
export const SIDEBAR_EVENT = 'veno-sidebar-collapsed-change';
export const DASHBOARDS_EXPANDED_STORAGE_KEY = 'veno-sidebar-dashboards-expanded';
export const DASHBOARDS_EXPANDED_EVENT = 'veno-sidebar-dashboards-expanded-change';
export const SIDEBAR_WIDTH_EXPANDED = '270px';
export const SIDEBAR_WIDTH_COLLAPSED = '76px';

const FEEDBACK_FORM_URL = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL?.trim();

export const DASHBOARD_LINKS: ReadonlyArray<SidebarDashboardLink> = [
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings', ownerOnly: true },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: 'key', ownerOnly: true },
];

export const SECONDARY_LINKS: ReadonlyArray<SidebarSecondaryLink> = [
  { href: '/dashboard/about', label: 'About', icon: 'info' },
  {
    href: 'https://github.com/DanielDanielsson/VenoDashboard',
    label: 'GitHub',
    icon: 'github',
    external: true,
  },
];

export const DEFAULT_CALLS_TO_ACTION: ReadonlyArray<SidebarCallToAction> = [
  {
    id: 'feedback',
    title: 'Help us improve',
    body: 'Tell us what you think about Veno and how we can improve it!',
    href: FEEDBACK_FORM_URL || 'mailto:danieldanielsson.dev@gmail.com?subject=Veno%20Dashboard%20feedback',
    actionLabel: 'Share feedback',
    icon: 'mail',
  },
];
