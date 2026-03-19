import React from 'react';
import { NavigationLink } from '../../components/NavigationLink';

const DASHBOARD_LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/glucose', label: 'Glucose' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/integrations', label: 'Integrations' },
  { href: '/dashboard/api-keys', label: 'API Keys' },
] as const;

export const SideBarNavigation = () => {
  return (
    <nav>
      <ul>
        {DASHBOARD_LINKS.map((link) => (
          <NavigationLink key={link.href} href={link.href}>
            {link.label}
          </NavigationLink>
        ))}
      </ul>
    </nav>
  );
};
