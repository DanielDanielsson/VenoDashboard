import { DashboardNotificationsBridge } from '@ui/compositions/DashboardNotificationsBridge/DashboardNotificationsBridge';
import { SideBarNavigation } from '@ui/compositions/SideBarNavigation';
import { requireOwnerSession } from '@/lib/auth';

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireOwnerSession();

  return (
    <div className="min-h-screen bg-(--bg)">
      <SideBarNavigation />
      <main className="md:ml-[230px] px-4 pt-(--spacing-dashboard-top) pb-8">
        <DashboardNotificationsBridge />
        <div className="dashboard-fullwidth-container section-stack">
          {children}
        </div>
      </main>
    </div>
  );
}
