import { GlucoseAnalysisView } from '@ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView';
import { getOwnerSession } from '@/lib/auth';
import { dashboardGlucoseWorkspace } from '@/lib/glucose/dashboard-workspace';

export const metadata = {
  title: 'Statistics'
};

export default async function DashboardStatisticsPage() {
  const session = await getOwnerSession();
  let initialSnapshot;

  try {
    const workspaceSession = await dashboardGlucoseWorkspace.open({ range: '3d' });
    initialSnapshot = workspaceSession.snapshot;
  } catch {
    initialSnapshot = undefined;
  }

  return (
    <div className="section-stack">
      <header
        className="flex flex-col justify-center"
        style={{ minHeight: 'calc(var(--spacing-dashboard-content-top) - var(--spacing-dashboard-top) - 1.25rem)' }}
      >
        <div>
          <h1 className="page_title text-text">
            Statistics
          </h1>
          <p className="page_subtitle mt-1 text-text-dim">Deep dive into your glucose data</p>
        </div>
      </header>

      <GlucoseAnalysisView isOwner={Boolean(session)} initialSnapshot={initialSnapshot} />
    </div>
  );
}
