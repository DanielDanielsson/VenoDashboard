'use client';

import type { ReactElement } from 'react';
import { usePathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import { Link } from '../../base/Link';
import { Icon } from '../../base/Icon';
import type { NavigationLinkProps, NavigationLinkTheme } from './NavigationLink.types';

const THEME_CLASS: Record<NavigationLinkTheme, string> = {
  light: 'theme-nav-link-light',
  dark: 'theme-nav-link-dark',
};

export const NavigationLink = ({
  children,
  icon,
  theme,
  href,
  ...rest
}: NavigationLinkProps): ReactElement => {
  const pathname = usePathname();
  const active = pathname === (typeof href === 'string' ? href : href.pathname);

  return (
    <li className={twMerge('relative rounded-lg rounded-tr-none before:absolute before:right-0 before:top-0 before:h-4 before:w-4 before:bg-nav-link-corner before:transition-colors before:content-[\'\'] hover:before:bg-nav-link-corner-hover', active && 'before:bg-nav-link-corner-hover', theme && THEME_CLASS[theme])}>
      <Link
        href={href}
        {...rest}
        twStyles={twMerge('ui_nav_text relative flex items-center gap-3 rounded-lg bg-nav-link-bg px-3 py-2.5 text-nav-link-text transition-colors hover:bg-nav-link-bg-hover hover:text-nav-link-text-hover', active && 'bg-nav-link-bg-hover text-nav-link-text-hover')}
      >
        {icon && <Icon icon={icon} twStyles="h-5 w-5" />}
        {children}
      </Link>
    </li>
  );
};
