import type { IconName } from '../../base/Icon';

export interface SidebarDashboardLink {
  href: string;
  label: string;
  icon: IconName;
  ownerOnly?: boolean;
}

export interface SidebarSecondaryLink {
  href: string;
  label: string;
  icon: IconName;
  external?: boolean;
}

export interface PinnedDashboardNavigationItem {
  uid: string;
  title: string;
  icon?: IconName | null;
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

export interface SideBarNavigationProps {
  isOwner?: boolean;
  pinnedDashboards?: PinnedDashboardNavigationItem[];
  homeDashboardUid?: string;
  currentUser?: SidebarUser;
  callsToAction?: ReadonlyArray<SidebarCallToAction>;
  initialCollapsed?: boolean;
  initialDashboardsExpanded?: boolean;
}

export interface SidebarCallToActionCardProps {
  callToAction: SidebarCallToAction;
  collapsed: boolean;
}

export interface SidebarUserCardProps {
  user: SidebarUser;
  isOwner: boolean;
  layoutCollapsed: boolean;
  labelClassName: string;
  showNotificationDot: boolean;
}
