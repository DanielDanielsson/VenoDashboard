import { DashboardNotificationsBridge } from '@ui/compositions/DashboardNotificationsBridge/DashboardNotificationsBridge';
import { MobileDesktopNotice } from '@ui/compositions/MobileDesktopNotice/MobileDesktopNotice';
import { SideBarNavigation } from '@ui/compositions/SideBarNavigation';
import { DynamicFavicon } from '@ui/components/DynamicFavicon/DynamicFavicon';
import { getOwnerSession } from '@/lib/auth';

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getOwnerSession();

  return (
    <div className="min-h-screen bg-bg">
      <MobileDesktopNotice />
      <div className="hidden md:block">
        <SideBarNavigation isOwner={Boolean(session)} />
        <main className="px-4 pb-20 pt-dashboard-top md:ml-[230px] md:pb-8">
          <DynamicFavicon />
          {session ? <DashboardNotificationsBridge /> : null}
          <div className="dashboard-fullwidth-container section-stack">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
