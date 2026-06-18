import type { SharedTimer } from '@/lib/veno-api/types';

export const DASHBOARD_TIMERS_CONNECTED_EVENT = 'pulse-timers-connected';
export const DASHBOARD_TIMER_STARTED_EVENT = 'pulse-timer-started';
export const DASHBOARD_TIMER_REMOVED_EVENT = 'pulse-timer-removed';

export interface DashboardTimersConnectedDetail {
  items: SharedTimer[];
  serverNow: string;
}

export interface DashboardTimerStartedDetail {
  timer: SharedTimer;
  serverNow: string;
}

export interface DashboardTimerRemovedDetail {
  timerId: string;
  serverNow: string;
}
