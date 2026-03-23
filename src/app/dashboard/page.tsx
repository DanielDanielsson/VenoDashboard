import { DashboardErrorState } from '@ui/components/DashboardErrorState/DashboardErrorState';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { LiveGlucosePanel } from '@ui/compositions/LiveGlucosePanel';
import { SharedTimersPanel } from '@ui/compositions/SharedTimersPanel/SharedTimersPanel';
import { TimeInRangePanel } from '@ui/compositions/TimeInRangePanel';
import { getOwnerSession } from '@/lib/auth';
import type { PulseApiStatusReport } from '@/lib/pulse-api/types';
import {
  PulseApiClientError,
  fetchAdminHealthSteps,
  fetchApiStatus,
  fetchConsumerProfile
} from '@/lib/pulse-api/client';
import {
  fetchTandemBasalHistory,
  fetchTandemEventHistory
} from '@/lib/pulse-api/glucose';

function formatLag(value: number | null | undefined): string {
  if (value == null) {
    return 'n/a';
  }

  const roundedMinutes = Math.max(0, Math.round(value));
  const days = Math.floor(roundedMinutes / (24 * 60));
  const hours = Math.floor((roundedMinutes % (24 * 60)) / 60);
  const minutes = roundedMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function getLatestIsoTimestamp(values: Array<string | null | undefined>): string | null {
  let latestMs = Number.NEGATIVE_INFINITY;
  let latestIso: string | null = null;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const timestampMs = new Date(value).getTime();
    if (Number.isNaN(timestampMs)) {
      continue;
    }

    if (timestampMs > latestMs) {
      latestMs = timestampMs;
      latestIso = new Date(timestampMs).toISOString();
    }
  }

  return latestIso;
}

export default async function DashboardPage() {
  const session = await getOwnerSession();
  let report: PulseApiStatusReport | null = null;
  let message: string | null = null;
  let greetingName: string | null = null;
  const now = new Date();
  const healthStepsFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const healthStepsTo = now.toISOString();
  const recentTandemFrom = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const recentTandemTo = now.toISOString();
  let latestHealthStepBucketEnd: string | null = null;
  let latestTandemActivityAt: string | null = null;

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
    const [statusReport, healthSteps, tandemBasal, tandemEvents] = await Promise.all([
      fetchApiStatus(),
      fetchAdminHealthSteps(healthStepsFrom, healthStepsTo).catch(() => ({ items: [] })),
      fetchTandemBasalHistory(recentTandemFrom, recentTandemTo, 5000).catch(() => ({ items: [], meta: { from: recentTandemFrom, to: recentTandemTo, limit: 5000, returned: 0 } })),
      fetchTandemEventHistory(recentTandemFrom, recentTandemTo, 5000).catch(() => ({ items: [], meta: { from: recentTandemFrom, to: recentTandemTo, limit: 5000, returned: 0 } }))
    ]);
    report = statusReport;
    latestHealthStepBucketEnd = getLatestIsoTimestamp(
      healthSteps.items.map((item) => item.bucketEnd)
    );
    latestTandemActivityAt = getLatestIsoTimestamp([
      ...tandemBasal.items.map((item) => item.timestamp),
      ...tandemEvents.items.map((item) => item.timestamp)
    ]);
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

  const healthKitAgeMinutes = latestHealthStepBucketEnd
    ? (now.getTime() - new Date(latestHealthStepBucketEnd).getTime()) / (60 * 1000)
    : null;
  const tandemAgeMinutes = latestTandemActivityAt
    ? (now.getTime() - new Date(latestTandemActivityAt).getTime()) / (60 * 1000)
    : report.tandem.latestReadingAgeMinutes;

  const connections = [
    { name: 'Dexcom official API', type: 'Official glucose', connected: report.official.connected, age: formatLag(report.official.latestReadingAgeMinutes) },
    { name: 'Dexcom share API', type: 'Share glucose', connected: report.share.connected, age: formatLag(report.share.latestReadingAgeMinutes) },
    { name: 'Tandem', type: 'Pump', connected: report.tandem.connected, age: formatLag(tandemAgeMinutes) },
    { name: 'Apple HealthKit', type: 'Steps', connected: latestHealthStepBucketEnd != null, age: formatLag(healthKitAgeMinutes) },
  ];
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
        <h1 className="page_title text-(--text)">
          {session
            ? greetingName ? `Hi, ${greetingName}!` : 'Hi!'
            : 'Welcome, visitor!'}
        </h1>
        <p className="page_subtitle mt-1 text-(--text-dim)">
          {session
            ? "Here\u0027s your glucose overview for today!"
            : "Here\u0027s Daniel\u0027s glucose overview for today!"}
        </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <LiveGlucosePanel
          latestReadingTimestamp={latestSource?.latestReading?.timestamp}
        />

        <SharedTimersPanel readOnly={!session} />

        <TimeInRangePanel />

        <DashboardPanel
          title="Connections"
          headerRight={<span className="ui_caption_strong text-(--text-dim)">{connections.length} total</span>}
        >
          <div className="flex flex-col gap-3">
            {connections.map((conn) => (
              <div key={conn.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${conn.connected ? 'bg-success' : 'bg-(--text-soft)'}`} />
                  <div>
                    <p className="body_text_strong text-(--text)">{conn.name}</p>
                    <p className="ui_caption text-(--text-dim)">{conn.type}</p>
                  </div>
                </div>
                <span className="ui_caption text-(--text-dim)">
                  {conn.connected ? `${conn.age} ago` : 'Not connected'}
                </span>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
