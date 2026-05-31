import Link from 'next/link';
import { SignOutButton } from '@ui/components/SignOutButton/SignOutButton';
import { getOwnerSession } from '@/lib/auth';
import { ThemeToggle } from '@ui/components/ThemeToggle/ThemeToggle';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/api', label: 'API' },
  { href: '/apps', label: 'Apps' },
  { href: '/docs', label: 'Docs' },
  { href: '/agents', label: 'Agents' }
] as const;

export const SiteHeader = async () => {
  const session = await getOwnerSession();

  return (
    <header className="site-header">
      <div className="shell-container shell-container--wide site-header__inner">
        <Link href="/" className="site-brand">
          <span className="site-brand__pulse" />
          <span>
            <span className="site-brand__name">PulseGlucose</span>
            <span className="site-brand__sub">clean docs for live glucose apps</span>
          </span>
        </Link>

        <div className="site-header__actions">
          <nav className="site-nav" aria-label="Primary">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="site-nav__link">
                {link.label}
              </Link>
            ))}
            <Link href={session ? '/dashboard' : '/login'} className="site-nav__link site-nav__link--cta">
              {session ? 'Dashboard' : 'Sign in'}
            </Link>
            {session && <SignOutButton />}
          </nav>
          <div className="site-header__utility">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};
