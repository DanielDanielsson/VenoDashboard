import React from 'react';
import Link from 'next/link';
import { NavigationLink } from '../../components/NavigationLink';
import { Icon } from '../../base/Icon';
import type { IconName } from '../../base/Icon';
import { ThemeToggle } from '../../components/ThemeToggle';

const DASHBOARD_LINKS: ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName;
  ownerOnly?: boolean;
}> = [
  { href: '/dashboard', label: 'Overview', icon: 'home' },
  { href: '/dashboard/statistics', label: 'Statistics', icon: 'activity' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings', ownerOnly: true },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: 'key', ownerOnly: true },
];

export const SideBarNavigation = ({ isOwner = false }: { isOwner?: boolean }) => {
  return (
    <nav className="fixed left-0 top-0 hidden h-screen w-[230px] flex-col border-r border-nav-link-text/50 p-4 md:flex">
      <Icon icon="veno-logo" title="Veno" twStyles="mx-auto h-[100px] w-32 text-text" />

      <ul className="mt-6 flex flex-col gap-2">
        {DASHBOARD_LINKS.map((link) => {
          if (!link.ownerOnly || isOwner) {
            return (
              <NavigationLink key={link.href} href={link.href} icon={link.icon}>
                {link.label}
              </NavigationLink>
            );
          }

          return (
            <li
              key={link.href}
              className="relative rounded-lg rounded-tr-none before:absolute before:right-0 before:top-0 before:h-4 before:w-4 before:bg-nav-link-corner/35 before:content-['']"
            >
              <div className="ui_nav_text relative flex items-center gap-3 rounded-lg bg-nav-link-bg/45 px-3 py-2.5 text-nav-link-text/45">
                <Icon icon={link.icon} twStyles="h-5 w-5" />
                <span className="flex-1">{link.label}</span>
                <span className="ui_micro_label text-nav-link-text/35">Admin</span>
              </div>
            </li>
          );
        })}
      </ul>

      <ul className="mt-3 flex flex-col gap-0.5 border-t border-border px-1 pt-3">
        <li>
          <Link href="/dashboard/about" className="body_text flex items-center rounded px-2 py-1.5 text-text-soft transition-colors hover:text-text">
            About
          </Link>
        </li>
        <li>
          <Link href="https://github.com/DanielDanielsson/VenoDashboard" target="_blank" rel="noopener noreferrer" className="body_text flex items-center rounded px-2 py-1.5 text-text-soft transition-colors hover:text-text">
            GitHub
          </Link>
        </li>
        {!isOwner ? (
          <li>
            <Link href="/login" className="body_text flex items-center rounded px-2 py-1.5 text-text-soft transition-colors hover:text-text">
              Admin sign in
            </Link>
          </li>
        ) : null}
      </ul>

      <div className="px-1 pt-2">
        <ThemeToggle />
      </div>
    </nav>
  ); 
};
