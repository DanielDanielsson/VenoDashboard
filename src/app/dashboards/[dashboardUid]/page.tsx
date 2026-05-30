import { notFound, redirect } from 'next/navigation';
import { DashboardPageHeader } from '@ui/compositions/DashboardPageHeader/DashboardPageHeader';
import { GlucoseAnalysisView } from '@ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView';
import type { LiveDashboardContext } from '@ui/compositions/DashboardDefinitionRenderer';
import { OverviewDashboardView } from '@ui/compositions/OverviewDashboardView/OverviewDashboardView';
import { getOwnerSession } from '@/lib/auth';
import {
  buildConnectionMapSnapshot,
  getLatestHealthStepBucketEnd,
  getLatestTandemActivityAt,
} from '@/lib/dashboard/connection-map';
import { getDashboardDescriptionText } from '@/lib/dashboard/metadata';
import { DashboardResourceRedirectError, loadDashboardResource } from '@/lib/dashboard/resources';
import { parseStatisticsDashboardUrlState } from '@/lib/dashboard/url-state';
import { dashboardGlucoseWorkspace } from '@/lib/glucose/dashboard-workspace';
import type { HistorySelection } from '@/lib/glucose/history-cache';
import {
  fetchAdminHealthSteps,
  fetchApiStatus,
  listApiKeys,
} from '@/lib/pulse-api/client';
import {
  fetchTandemBasalHistory,
  fetchTandemEventHistory,
} from '@/lib/pulse-api/glucose';

interface DashboardPageProps {
  params: Promise<{
    dashboardUid: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

async function loadLiveDashboardContext(isOwner: boolean): Promise<LiveDashboardContext> {
  const now = new Date();
  const healthStepsFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const healthStepsTo = now.toISOString();
  const recentTandemFrom = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const recentTandemTo = now.toISOString();

  try {
    const [statusReport, healthSteps, tandemBasal, tandemEvents, apiKeys] = await Promise.all([
      fetchApiStatus(),
      fetchAdminHealthSteps(healthStepsFrom, healthStepsTo).catch(() => ({ items: [] })),
      fetchTandemBasalHistory(recentTandemFrom, recentTandemTo, 5000).catch(() => ({ items: [] })),
      fetchTandemEventHistory(recentTandemFrom, recentTandemTo, 5000).catch(() => ({ items: [] })),
      listApiKeys().catch(() => ({ items: [] })),
    ]);
    const latestSource = statusReport.official.latestReading
      ? statusReport.official
      : statusReport.share.latestReading ? statusReport.share : null;

    return {
      isOwner,
      latestReadingTimestamp: latestSource?.latestReading?.timestamp,
      initialConnectionSnapshot: buildConnectionMapSnapshot({
        report: statusReport,
        latestHealthStepBucketEnd: getLatestHealthStepBucketEnd(healthSteps.items),
        latestTandemActivityAt: getLatestTandemActivityAt({
          basalTimestamps: tandemBasal.items.map((item) => item.timestamp),
          eventTimestamps: tandemEvents.items.map((item) => item.timestamp),
        }),
        apiKeys: apiKeys.items,
        now,
      }),
    };
  } catch {
    return {
      isOwner,
      initialConnectionSnapshot: null,
    };
  }
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { dashboardUid } = await params;
  const session = await getOwnerSession();
  const dashboardState = await loadDashboardResource(dashboardUid).catch((error: unknown) => {
    if (error instanceof DashboardResourceRedirectError) {
      redirect(`/dashboards/${error.dashboardUid}`);
    }

    return null;
  });

  if (!dashboardState) {
    notFound();
  }

  const dashboard = dashboardState.dashboard;
  const dashboardDescription = getDashboardDescriptionText(dashboardState.description);
  const isOwner = Boolean(session);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialUrlState = parseStatisticsDashboardUrlState(resolvedSearchParams);
  const initialSelection: HistorySelection | undefined = dashboardState.type === 'timeRange'
    ? initialUrlState.initialSelection ?? {
      kind: 'preset',
      range: dashboardState.defaultTimeRange ?? '3d',
    }
    : undefined;
  let initialSnapshot;
  let liveDashboardContext: LiveDashboardContext | null = null;

  if (dashboardState.type === 'timeRange') {
    try {
      const workspaceSession = await dashboardGlucoseWorkspace.open(
        initialSelection?.kind === 'custom'
          ? { window: initialSelection.window }
          : { range: initialSelection?.range ?? '3d' },
      );
      initialSnapshot = workspaceSession.snapshot;
    } catch {
      initialSnapshot = undefined;
    }
  } else {
    liveDashboardContext = await loadLiveDashboardContext(isOwner);
  }

  return (
    <div className="section-stack">
      <DashboardPageHeader
        dashboardUid={dashboard.spec.uid}
        title={dashboard.spec.title}
        description={dashboardDescription}
      />

      {dashboardState.type === 'timeRange' ? (
        <GlucoseAnalysisView
          isOwner={isOwner}
          initialSnapshot={initialSnapshot}
          dashboardDefinition={dashboard}
          dashboardVersion={dashboardState.version}
          initialSelection={initialSelection}
          initialTimeZone={initialUrlState.initialTimeZone}
          allowDashboardDelete
        />
      ) : liveDashboardContext ? (
        <OverviewDashboardView
          dashboard={dashboard}
          dashboardVersion={dashboardState.version}
          context={liveDashboardContext}
          allowDashboardDelete
        />
      ) : null}
    </div>
  );
}
