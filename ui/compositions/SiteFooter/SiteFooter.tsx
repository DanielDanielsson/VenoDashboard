import Link from 'next/link';

export const SiteFooter = () => {
  const apiBaseUrl = (process.env.PULSE_API_BASE_URL || 'http://localhost:3101').replace(/\/$/, '');

  return (
    <footer className="site-footer">
      <div className="shell-container shell-container--wide site-footer__inner">
        <div>
          <p className="site-footer__title">PulseGlucoseWeb</p>
          <p className="site-footer__copy">Public docs, app references, and machine readable contracts.</p>
        </div>

        <div className="site-footer__links">
          <Link href="/docs">Docs</Link>
          <Link href="/apps">Apps</Link>
          <a href={`${apiBaseUrl}/status`}>API Status</a>
          <Link href="/agents">Agent Context</Link>
        </div>
      </div>
    </footer>
  );
};
