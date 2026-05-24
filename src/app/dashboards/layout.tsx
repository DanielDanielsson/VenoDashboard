import { DashboardNotificationsBridge } from '@ui/compositions/DashboardNotificationsBridge/DashboardNotificationsBridge';
import { DashboardTimersBridge } from '@ui/compositions/DashboardTimersBridge';
import { MobileDesktopNotice } from '@ui/compositions/MobileDesktopNotice/MobileDesktopNotice';
import { SideBarNavigation } from '@ui/compositions/SideBarNavigation';
import { DynamicFavicon } from '@ui/components/DynamicFavicon/DynamicFavicon';
import { getOwnerSession } from '@/lib/auth';
import { loadDashboardLibrary } from '@/lib/dashboard/library';
import { loadSidebarUser } from '@/lib/dashboard/sidebar-user';

export default async function DashboardsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [session, library] = await Promise.all([
    getOwnerSession(),
    loadDashboardLibrary(),
  ]);
  const homeDashboard = library.dashboards.find((dashboard) => dashboard.isHome);
  const pinnedDashboards = library.dashboards
    .filter((dashboard) => dashboard.isPinned)
    .map((dashboard) => ({
      uid: dashboard.uid,
      title: dashboard.title,
    }));
  const sidebarUser = await loadSidebarUser(session);

  return (
    <div className="min-h-screen bg-bg">
      <MobileDesktopNotice />
      <div className="hidden md:block">
        <SideBarNavigation isOwner={Boolean(session)} pinnedDashboards={pinnedDashboards} homeDashboardUid={homeDashboard?.uid} currentUser={sidebarUser} />
        <main className="px-4 pb-20 pt-dashboard-top transition-[margin-left] duration-200 md:ml-[var(--dashboard-sidebar-width,270px)] md:pb-8">
          <DynamicFavicon />
          {session ? <DashboardNotificationsBridge /> : null}
          {session ? <DashboardTimersBridge /> : null}
          <div className="dashboard-fullwidth-container section-stack">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
