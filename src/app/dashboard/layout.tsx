import { DashboardNotificationsBridge } from '@ui/compositions/DashboardNotificationsBridge/DashboardNotificationsBridge';
import { SideBarNavigation } from '@ui/compositions/SideBarNavigation';
import { DashboardGlucoseBadge } from '@ui/components/DashboardGlucoseBadge/DashboardGlucoseBadge';
import { requireOwnerSession } from '@/lib/auth';
import { fetchConsumerProfile } from '@/lib/pulse-api/client';

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireOwnerSession();
  let greetingName: string | null = null;

  try {
    const { profile } = await fetchConsumerProfile();
    const firstName = profile.firstName.trim();
    const displayName = profile.displayName.trim();
    greetingName = firstName || displayName.split(/\s+/)[0] || null;
  } catch {
    greetingName = null;
  }

  return (
    <div className="flex">
      <SideBarNavigation />
      <main className="page-frame flex-1">
        <DashboardNotificationsBridge />
        <div className="dashboard-fullwidth-container section-stack">
          <section className="panel dashboard-hero">
            <div className="dashboard-hero__header">
              {/* <div className="dashboard-hero__copy">
                <h1 className="dashboard-hero__title">{greetingName ? `Hi, ${greetingName}!` : 'Hi!'}</h1>
              </div>
              <div className="dashboard-hero__actions">
                <DashboardGlucoseBadge />
              </div> */}
            </div>
          </section>

          {children}
        </div>
      </main>
    </div>
  );
}
