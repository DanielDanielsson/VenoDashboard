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
  | 'edit'
  | 'chevron-left'
  | 'chevron-down'
  | 'chevron-up'
  | 'sidebar-expand'
  | 'sidebar-collapse'
  | 'close'
  | 'settings'
  | 'key'
  | 'glucose'
  | 'server'
  | 'github'
  | 'desktop'
  | 'smartphone'
  | 'lightbulb'
  | 'dashboard-grid'
  | 'veno-wordmark'
  | 'veno-glucose-indicator'
  | 'veno-logo';

export type IconProps = Stylable & {
  icon: IconName;
  title?: string;
  size?: string;
};
