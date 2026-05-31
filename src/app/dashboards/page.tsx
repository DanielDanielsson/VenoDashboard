import { DashboardLibrary } from '@/containers/DashboardLibrary/DashboardLibrary';
import { getOwnerSession } from '@/lib/auth';
import { loadDashboardLibrary } from '@/lib/dashboard/library';

export const metadata = {
  title: 'Dashboards',
};

export default async function DashboardsPage() {
  const library = await loadDashboardLibrary();
  const session = await getOwnerSession();

  return (
    <div className="section-stack">
      <DashboardLibrary dashboards={library.dashboards} isOwner={Boolean(session)} />
    </div>
  );
}
