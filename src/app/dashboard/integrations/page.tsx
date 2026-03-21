import { DashboardErrorState } from '@ui/components/DashboardErrorState/DashboardErrorState';
import Link from 'next/link';
import { requireOwnerSession } from '@/lib/auth';
import { PulseApiClientError, fetchApiStatus } from '@/lib/pulse-api/client';

interface IntegrationsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return value || '';
}

export default async function DashboardIntegrationsPage({ searchParams }: IntegrationsPageProps) {
  await requireOwnerSession();
  const params = searchParams ? await searchParams : {};
  const dexcomState = readParam(params.dexcom);
  const dexcomError = readParam(params.error);
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
          : 'Failed to load integrations';
  }

  if (!report) {
    return <DashboardErrorState title="Integrations unavailable" message={message || 'Failed to load integrations'} />;
  }

  const connected = report.official.connected;

  return (
    <div className="section-stack">
      <section className="panel dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <p className="kicker">Upstream integrations</p>
            <h1 className="dashboard-section__title">Dexcom Connect</h1>
            <p className="dashboard-section__meta">Start the existing Dexcom OAuth flow from the web dashboard.</p>
          </div>
        </div>

        {dexcomState === 'connected' ? (
          <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Dexcom OAuth completed and returned to the dashboard.
          </p>
        ) : null}

        {dexcomError ? (
          <p className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Dexcom connect failed: {dexcomError}
          </p>
        ) : null}

        <div className="dashboard-link-grid dashboard-link-grid--two">
          <div className="dashboard-link-card">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Official Dexcom pipeline</p>
            <p className="mt-3 text-2xl font-semibold text-[var(--text)]">{connected ? 'Connected' : 'Not connected'}</p>
            <p className="mt-3 text-sm text-[var(--text-dim)]">
              Current latest reading age: {report.official.latestReadingAgeMinutes == null ? 'n/a' : `${Math.round(report.official.latestReadingAgeMinutes * 10) / 10}m`}
            </p>
          </div>

          <div className="dashboard-link-card">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Connect action</p>
            <p className="mt-3 text-sm text-[var(--text-dim)]">
              This uses the Dexcom gateway flow, then returns here when complete.
            </p>
            <Link href="/api/dashboard/dexcom/connect" className="button-primary mt-6 inline-flex">
              Connect Dexcom
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
