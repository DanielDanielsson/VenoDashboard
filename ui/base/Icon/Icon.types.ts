import type { Stylable } from '../../types';

export type IconName =
  | 'chevron-right'
  | 'chevron-down'
  | 'search'
  | 'menu'
  | 'menu-close'
  | 'sun'
  | 'moon'
  | 'home'
  | 'activity'
  | 'info'
  | 'settings'
  | 'plug'
  | 'key'
  | 'glucose'
  | 'veno-logo';

export type IconProps = Stylable & {
  icon: IconName;
  title?: string;
  size?: string;
};
