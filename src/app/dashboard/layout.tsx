import { DashboardNotificationsBridge } from '@ui/compositions/DashboardNotificationsBridge/DashboardNotificationsBridge';
import { SideBarNavigation } from '@ui/compositions/SideBarNavigation';
import { DynamicFavicon } from '@ui/components/DynamicFavicon/DynamicFavicon';
import { getOwnerSession } from '@/lib/auth';

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getOwnerSession();

  return (
    <div className="min-h-screen bg-(--bg)">
      <SideBarNavigation isOwner={Boolean(session)} />
      <main className="md:ml-[230px] px-4 pt-(--spacing-dashboard-top) pb-8">
        <DynamicFavicon />
        {session ? <DashboardNotificationsBridge /> : null}
        <div className="dashboard-fullwidth-container section-stack">
          {children}
        </div>
      </main>
    </div>
  );
}
