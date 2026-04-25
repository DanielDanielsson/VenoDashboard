import { DashboardErrorState } from '@ui/components/DashboardErrorState/DashboardErrorState';
import { OverviewDashboardView } from '@ui/compositions/OverviewDashboardView/OverviewDashboardView';
import { getOwnerSession } from '@/lib/auth';
import type { PulseApiStatusReport } from '@/lib/pulse-api/types';
import { loadDashboardDefinition } from '@/lib/dashboard/settings';
import {
  PulseApiClientError,
  fetchAdminHealthSteps,
  fetchApiStatus,
  fetchConsumerProfile,
  listApiKeys,
} from '@/lib/pulse-api/client';
import {
  fetchTandemBasalHistory,
  fetchTandemEventHistory
} from '@/lib/pulse-api/glucose';
import {
  buildConnectionMapSnapshot,
  getLatestHealthStepBucketEnd,
  getLatestTandemActivityAt,
} from '@/lib/dashboard/connection-map';

export default async function DashboardPage() {
  const session = await getOwnerSession();
  let report: PulseApiStatusReport | null = null;
  let message: string | null = null;
  let greetingName: string | null = null;
  const dashboardState = await loadDashboardDefinition('overview');
  const now = new Date();
  const healthStepsFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const healthStepsTo = now.toISOString();
  const recentTandemFrom = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const recentTandemTo = now.toISOString();
  let initialConnectionSnapshot = null;

  if (session) {
    try {
      const { profile } = await fetchConsumerProfile();
      const firstName = profile.firstName.trim();
      const displayName = profile.displayName.trim();
      greetingName = firstName || displayName.split(/\s+/)[0] || null;
    } catch {
      greetingName = null;
    }
  }

  try {
    const [statusReport, healthSteps, tandemBasal, tandemEvents, apiKeys] = await Promise.all([
      fetchApiStatus(),
      fetchAdminHealthSteps(healthStepsFrom, healthStepsTo).catch(() => ({ items: [] })),
      fetchTandemBasalHistory(recentTandemFrom, recentTandemTo, 5000).catch(() => ({ items: [], meta: { from: recentTandemFrom, to: recentTandemTo, limit: 5000, returned: 0 } })),
      fetchTandemEventHistory(recentTandemFrom, recentTandemTo, 5000).catch(() => ({ items: [], meta: { from: recentTandemFrom, to: recentTandemTo, limit: 5000, returned: 0 } })),
      listApiKeys().catch(() => ({ items: [] })),
    ]);
    report = statusReport;
    initialConnectionSnapshot = buildConnectionMapSnapshot({
      report: statusReport,
      latestHealthStepBucketEnd: getLatestHealthStepBucketEnd(healthSteps.items),
      latestTandemActivityAt: getLatestTandemActivityAt({
        basalTimestamps: tandemBasal.items.map((item) => item.timestamp),
        eventTimestamps: tandemEvents.items.map((item) => item.timestamp),
      }),
      apiKeys: apiKeys.items,
      now,
    });
  } catch (error) {
    if (error instanceof PulseApiClientError) {
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
    } else {
      message = 'Failed to load dashboard';
    }
  }

  if (!report) {
    return <DashboardErrorState title="Dashboard unavailable" message={message || 'Failed to load dashboard'} />;
  }

  let latestSource = null;
  if (report.official.latestReading) {
    latestSource = report.official;
  } else if (report.share.latestReading) {
    latestSource = report.share;
  }

  return (
    <div className="section-stack">
      <header
        className="flex flex-col justify-center"
        style={{ minHeight: 'calc(var(--spacing-dashboard-content-top) - var(--spacing-dashboard-top) - 1.25rem)' }}
      >
        <div>
        <h1 className="page_title text-text">
          {session
            ? greetingName ? `Hi, ${greetingName}!` : 'Hi!'
            : 'Welcome, visitor!'}
        </h1>
        <p className="page_subtitle mt-1 text-text-dim">
          {session
            ? "Here\u0027s your glucose overview for today!"
            : "Here\u0027s Daniel\u0027s glucose overview for today!"}
        </p>
        </div>
      </header>
      <OverviewDashboardView
        dashboard={dashboardState.dashboard}
        dashboardVersion={dashboardState.version}
        context={{
          isOwner: Boolean(session),
          latestReadingTimestamp: latestSource?.latestReading?.timestamp,
          initialConnectionSnapshot,
        }}
      />
    </div>
  );
}
