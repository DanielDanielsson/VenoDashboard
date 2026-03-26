import type { Stylable } from '../../types';

export type IconName =
  | 'sun'
  | 'moon'
  | 'home'
  | 'activity'
  | 'info'
  | 'settings'
  | 'key'
  | 'glucose'
  | 'server'
  | 'desktop'
  | 'smartphone'
  | 'lightbulb'
  | 'veno-logo';

export type IconProps = Stylable & {
  icon: IconName;
  title?: string;
  size?: string;
};
