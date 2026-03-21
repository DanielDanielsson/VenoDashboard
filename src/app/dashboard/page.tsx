import { DashboardErrorState } from '@ui/components/DashboardErrorState/DashboardErrorState';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { LiveGlucosePanel } from '@ui/compositions/LiveGlucosePanel';
import { SharedTimersPanel } from '@ui/compositions/SharedTimersPanel/SharedTimersPanel';
import { TimeInRangePanel } from '@ui/compositions/TimeInRangePanel';
import { getOwnerSession } from '@/lib/auth';
import type { PulseApiStatusReport } from '@/lib/pulse-api/types';
import { PulseApiClientError, fetchApiStatus, fetchConsumerProfile } from '@/lib/pulse-api/client';

function formatLag(value: number | null | undefined): string {
  if (value == null) {
    return 'n/a';
  }

  return `${Math.round(value * 10) / 10}m`;
}

export default async function DashboardPage() {
  const session = await getOwnerSession();
  let report: PulseApiStatusReport | null = null;
  let message: string | null = null;
  let greetingName: string | null = null;

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
    report = await fetchApiStatus();
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

  const connections = [
    { name: 'Gateway API', type: 'Official Dexcom', connected: report.official.connected, age: formatLag(report.official.latestReadingAgeMinutes) },
    { name: 'Dexcom Share', type: 'Share', connected: report.share.connected, age: formatLag(report.share.latestReadingAgeMinutes) },
    { name: 'Tandem', type: 'Pump', connected: report.tandem.connected, age: formatLag(report.tandem.latestReadingAgeMinutes) },
  ];

  const activeConnections = connections.filter((c) => c.connected);
  let latestSource = null;
  if (report.official.latestReading) {
    latestSource = report.official;
  } else if (report.share.latestReading) {
    latestSource = report.share;
  }

  return (
    <div className="section-stack">
      <header className="min-h-[calc(var(--spacing-dashboard-content-top)-var(--spacing-dashboard-top)-1.25rem)] flex flex-col justify-center">
        <div>
        <h1 className="text-3xl font-bold tracking-tight text-(--text)">
          {greetingName ? `Hi, ${greetingName}!` : 'Hi!'}
        </h1>
        <p className="mt-1 text-sm text-(--text-dim)">Here&apos;s your glucose overview for today</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <LiveGlucosePanel
          latestReadingTimestamp={latestSource?.latestReading?.timestamp}
        />

        <SharedTimersPanel readOnly={!session} />

        <TimeInRangePanel />

        <DashboardPanel title="Connections">
          <p className="text-3xl font-bold text-(--text)">{activeConnections.length}</p>
          <p className="text-sm text-(--text-dim)">Active Devices</p>
          <div className="mt-4 flex flex-col gap-3">
            {connections.map((conn) => (
              <div key={conn.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${conn.connected ? 'bg-success' : 'bg-(--text-soft)'}`} />
                  <div>
                    <p className="text-sm font-medium text-(--text)">{conn.name}</p>
                    <p className="text-xs text-(--text-dim)">{conn.type}</p>
                  </div>
                </div>
                <span className="text-xs text-(--text-dim)">
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
