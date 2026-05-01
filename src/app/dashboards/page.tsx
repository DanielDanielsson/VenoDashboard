import { DashboardLibrary } from '@ui/compositions/DashboardLibrary/DashboardLibrary';
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
      <header
        className="flex flex-col justify-center"
        style={{ minHeight: 'calc(var(--spacing-dashboard-content-top) - var(--spacing-dashboard-top) - 1.25rem)' }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="page_title text-text">Dashboards</h1>
            <p className="page_subtitle mt-1 text-text-dim">Browse available Veno dashboard views</p>
          </div>
        </div>
      </header>

      <DashboardLibrary dashboards={library.dashboards} isOwner={Boolean(session)} />
    </div>
  );
}
