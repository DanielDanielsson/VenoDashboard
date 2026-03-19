import { DashboardErrorState } from '@ui/components/DashboardErrorState/DashboardErrorState';
import { SharedTimersPanel } from '@ui/compositions/SharedTimersPanel/SharedTimersPanel';
import Link from 'next/link';
import { PulseApiClientError, fetchApiStatus } from '@/lib/pulse-api/client';

function formatLag(value: number | null | undefined): string {
  if (value == null) {
    return 'n/a';
  }

  return `${Math.round(value * 10) / 10}m`;
}

export default async function DashboardPage() {
  let report = null;
  let message: string | null = null;

  try {
    report = await fetchApiStatus();
  } catch (error) {
    message =
      error instanceof PulseApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to load dashboard';
  }

  if (!report) {
    return <DashboardErrorState title="Dashboard unavailable" message={message || 'Failed to load dashboard'} />;
  }

  const cards = [
    {
      title: 'Official Dexcom',
      source: report.official
    },
    {
      title: 'Dexcom Share',
      source: report.share
    }
  ];

  return (
    <div className="section-stack">
      <SharedTimersPanel />

      <section className="panel dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <p className="kicker">Operational view</p>
            <h2 className="dashboard-section__title">API Overview</h2>
            <p className="dashboard-section__meta">Generated at {new Date(report.generatedAt).toLocaleString()}</p>
          </div>
          <div className="data-chip">Live control plane</div>
        </div>

        <div className="dashboard-source-grid">
          {cards.map((card) => (
            <article key={card.title} className="dashboard-source-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">{card.title}</p>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">
                    {card.source.connected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    card.source.stable
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                  }`}
                >
                  {card.source.stable ? 'Healthy' : 'Needs attention'}
                </span>
              </div>

              <div className="dashboard-stat-grid">
                <div className="dashboard-stat-card">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Latest reading</p>
                  <p className="mt-3 text-lg font-semibold text-[var(--text)]">
                    {card.source.latestReading ? `${card.source.latestReading.valueMmolL.toFixed(1)} mmol/L` : 'n/a'}
                  </p>
                </div>
                <div className="dashboard-stat-card">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Reading age</p>
                  <p className="mt-3 text-lg font-semibold text-[var(--text)]">
                    {formatLag(card.source.latestReadingAgeMinutes)}
                  </p>
                </div>
                <div className="dashboard-stat-card">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Source to DB lag</p>
                  <p className="mt-3 text-lg font-semibold text-[var(--text)]">
                    {formatLag(card.source.sourceToDbLagMinutes)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-link-grid">
        <Link href="/dashboard/settings" className="panel dashboard-link-card">
          <p className="kicker">Shared profile</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">Settings</h2>
          <p className="mt-3 text-sm text-[var(--text-dim)]">Update timezone, display name, avatar, units, and alarm sounds.</p>
        </Link>

        <Link href="/dashboard/integrations" className="panel dashboard-link-card">
          <p className="kicker">Dexcom</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">Integrations</h2>
          <p className="mt-3 text-sm text-[var(--text-dim)]">Start the Dexcom OAuth connect flow and monitor connectivity.</p>
        </Link>

        <Link href="/dashboard/api-keys" className="panel dashboard-link-card">
          <p className="kicker">Clients</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">API Keys</h2>
          <p className="mt-3 text-sm text-[var(--text-dim)]">Create and rotate client keys without touching the API repo UI.</p>
        </Link>
      </section>
    </div>
  );
}
