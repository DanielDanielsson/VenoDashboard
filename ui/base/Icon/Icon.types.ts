import type { Stylable } from '../../types';

export type IconName =
  | 'sun'
  | 'moon'
  | 'home'
  | 'activity'
  | 'workout-run'
  | 'workout-walk'
  | 'workout-cycle'
  | 'workout-strength'
  | 'workout-hiit'
  | 'workout-yoga'
  | 'workout-swim'
  | 'workout-hike'
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
