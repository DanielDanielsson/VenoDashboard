import Link from 'next/link';

interface DocsSidebarProps {
  groups: Array<{
    name: string;
    endpoints: Array<{ id: string; method: string; path: string }>;
  }>;
}

const CORE_DOC_LINKS = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/getting-started', label: 'Getting Started' },
  { href: '/docs/authentication', label: 'Authentication' },
  { href: '/docs/workflows', label: 'Workflows' },
  { href: '/docs/endpoints', label: 'Endpoint Index' },
  { href: '/docs/errors', label: 'Errors' }
];

export function DocsSidebar({ groups }: DocsSidebarProps) {
  return (
    <aside className="docs-sidebar">
      <section className="panel docs-shell">
        <p className="kicker">Documentation</p>
        <nav className="docs-nav-group mt-3">
          {CORE_DOC_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="docs-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="panel docs-shell">
        <p className="kicker">Consumer endpoints</p>
        <div className="mt-4">
          {groups.map((group) => (
            <div key={group.name} className="docs-nav-section">
              <p className="docs-nav-section__title">{group.name}</p>
              <div className="docs-nav-group">
                {group.endpoints.slice(0, 8).map((endpoint) => (
                  <Link key={endpoint.id} href={`/docs/endpoints/${endpoint.id}`} className="endpoint-link">
                    <span className="font-[var(--font-plex-mono)] text-[0.8em] opacity-70">{endpoint.method}</span>{' '}
                    {endpoint.path}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
