import { cookies } from 'next/headers';
import {
  DASHBOARDS_EXPANDED_COOKIE,
  SIDEBAR_COLLAPSED_COOKIE,
} from '@ui/compositions/SideBarNavigation/const';

export interface SidebarPreferences {
  collapsed: boolean;
  dashboardsExpanded: boolean;
}

export const loadSidebarPreferences = async (): Promise<SidebarPreferences> => {
  const cookieStore = await cookies();

  return {
    collapsed: cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === 'true',
    dashboardsExpanded: cookieStore.get(DASHBOARDS_EXPANDED_COOKIE)?.value !== 'false',
  };
};
