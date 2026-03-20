import type { LinkProps } from '../../base/Link';
import type { IconName } from '../../base/Icon';
import type { Themable } from '../../types';

export type NavigationLinkTheme = 'light' | 'dark';

export type NavigationLinkProps = LinkProps &
  Themable<NavigationLinkTheme> & {
    icon?: IconName;
  };
