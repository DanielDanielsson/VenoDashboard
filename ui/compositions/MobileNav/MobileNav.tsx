'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../../base/Icon';
import type { IconName } from '../../base/Icon';

const MOBILE_LINKS: ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName;
}> = [
  { href: '/dashboard', label: 'Overview', icon: 'home' },
  { href: '/dashboard/statistics', label: 'Statistics', icon: 'activity' },
  { href: '/dashboard/about', label: 'About', icon: 'veno-logo' },
];

export const MobileNav = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--border) bg-(--bg) md:hidden">
      <ul className="flex items-stretch justify-around">
        {MOBILE_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-2.5 text-center transition-colors ${active ? 'text-(--accent)' : 'text-(--text-soft)'}`}
              >
                <Icon icon={link.icon} twStyles="h-5 w-5" />
                <span className="ui_micro_label">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
