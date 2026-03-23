import Link from 'next/link';

export const metadata = {
  title: 'About',
};

export default function AboutPage() {
  return (
    <div className="section-stack">
      <header
        className="flex flex-col justify-center"
        style={{ minHeight: 'calc(var(--spacing-dashboard-content-top) - var(--spacing-dashboard-top) - 1.25rem)' }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-(--text)">About</h1>
          <p className="mt-1 text-sm text-(--text-dim)">What is VenoDashboard?</p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="dashboard-subpanel flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-(--text-soft)">The project</h2>
          <p className="text-sm leading-relaxed text-(--text-dim)">
            VenoDashboard is a personal glucose monitoring dashboard built around the Veno ecosystem.
            It pulls live CGM data from multiple sources and presents it in a clean, readable interface
            designed for day-to-day glucose awareness.
          </p>
          <p className="text-sm leading-relaxed text-(--text-dim)">
            The dashboard is intentionally public-facing for the overview and statistics views,
            so friends and family can check in without needing an account. Admin features like
            settings, API keys, and timer management stay behind a login.
          </p>
        </div>

        <div className="dashboard-subpanel flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-(--text-soft)">Data sources</h2>
          <ul className="flex flex-col gap-2">
            {[
              { name: 'Dexcom Gateway API', desc: 'Official Dexcom integration via the Veno gateway, providing real-time CGM readings.' },
              { name: 'Dexcom Share', desc: 'Follower access through the Dexcom Share network as a secondary source.' },
              { name: 'Tandem Pump', desc: 'Insulin pump telemetry for basal rate and bolus context alongside glucose data.' },
            ].map((source) => (
              <li key={source.name} className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-(--text)">{source.name}</span>
                <span className="text-xs text-(--text-dim)">{source.desc}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="dashboard-subpanel flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-(--text-soft)">Features</h2>
          <ul className="flex flex-col gap-2">
            {[
              'Live glucose reading with trend arrow and data freshness indicator',
              'Time in Range breakdown across configurable time windows',
              'Full glucose timeline chart with zoom and pan',
              'Ambulatory Glucose Profile (AGP) for pattern analysis',
              'Average glucose with min/max across selected range',
              'Shared timers for meal, exercise and correction tracking',
              'Light and dark theme support',
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-xs text-(--text-dim)">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--accent)" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="dashboard-subpanel flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-(--text-soft)">Stack</h2>
          <ul className="flex flex-col gap-2">
            {[
              { name: 'Next.js 15', desc: 'App router, server components, and edge-compatible API routes.' },
              { name: 'Tailwind CSS v4', desc: 'CSS-first design tokens with full dark/light theme support.' },
              { name: 'Recharts', desc: 'Composable chart library powering the glucose timeline and AGP.' },
              { name: 'VenoAPI', desc: 'The backend service aggregating all CGM and pump data sources.' },
            ].map((item) => (
              <li key={item.name} className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-(--text)">{item.name}</span>
                <span className="text-xs text-(--text-dim)">{item.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="dashboard-subpanel flex items-center justify-between gap-4">
        <p className="text-sm text-(--text-dim)">
          VenoDashboard is open source. Contributions, issues, and feedback are welcome on GitHub.
        </p>
        <Link
          href="https://github.com/hf-pulse/VenoDashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="button-secondary shrink-0"
        >
          View on GitHub
        </Link>
      </div>
    </div>
  );
}
