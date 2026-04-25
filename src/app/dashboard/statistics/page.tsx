import { GlucoseAnalysisView } from '@ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView';
import { getOwnerSession } from '@/lib/auth';
import { dashboardGlucoseWorkspace } from '@/lib/glucose/dashboard-workspace';
import { loadDashboardDefinition } from '@/lib/dashboard/settings';
import { parseStatisticsDashboardUrlState } from '@/lib/dashboard/url-state';

export const metadata = {
  title: 'Statistics'
};

interface DashboardStatisticsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardStatisticsPage({ searchParams }: DashboardStatisticsPageProps = {}) {
  const session = await getOwnerSession();
  const dashboardState = await loadDashboardDefinition('statistics');
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialUrlState = parseStatisticsDashboardUrlState(resolvedSearchParams);
  let initialSnapshot;

  try {
    const workspaceSession = await dashboardGlucoseWorkspace.open(
      initialUrlState.initialSelection?.kind === 'custom'
        ? { window: initialUrlState.initialSelection.window }
        : { range: '3d' },
    );
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

      <GlucoseAnalysisView
        isOwner={Boolean(session)}
        initialSnapshot={initialSnapshot}
        dashboardDefinition={dashboardState.dashboard}
        dashboardVersion={dashboardState.version}
        initialSelection={initialUrlState.initialSelection}
        initialTimeZone={initialUrlState.initialTimeZone}
      />
    </div>
  );
}
