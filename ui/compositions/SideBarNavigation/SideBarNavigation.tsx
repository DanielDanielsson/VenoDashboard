import React from 'react';
import { NavigationLink } from '../../components/NavigationLink';
import { Icon } from '../../base/Icon';
import type { IconName } from '../../base/Icon';

const DASHBOARD_LINKS: ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName;
}> = [
  { href: '/dashboard', label: 'Overview', icon: 'home' },
  { href: '/dashboard/glucose', label: 'Glucose', icon: 'activity' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
  { href: '/dashboard/integrations', label: 'Integrations', icon: 'plug' },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: 'key' },
];

export const SideBarNavigation = () => {
  return (
    <nav className="fixed left-0 top-0 hidden h-screen w-[230px] flex-col border-r border-nav-link-text/50 p-4 md:flex">
      <Icon icon="veno-logo" title="Veno" twStyles="mx-auto h-[100px] w-32 text-(--text)" />

      <ul className="mt-6 flex flex-col gap-2">
        {DASHBOARD_LINKS.map((link) => (
          <NavigationLink key={link.href} href={link.href} icon={link.icon}>
            {link.label}
          </NavigationLink>
        ))}
      </ul>
    </nav>
  ); 
};
