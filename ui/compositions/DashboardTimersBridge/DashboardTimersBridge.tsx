'use client';

import { useEffect, useRef } from 'react';
import type {
  SharedTimer,
  SharedTimerStreamConnectedPayload,
  TimerRemovedPayload,
  TimerStartedPayload
} from '@/lib/pulse-api/types';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import {
  DASHBOARD_TIMER_REMOVED_EVENT,
  DASHBOARD_TIMER_STARTED_EVENT,
  DASHBOARD_TIMERS_CONNECTED_EVENT,
} from './dashboardTimerEvents';
import { formatDurationLabel, getServerOffsetMs } from '@ui/compositions/SharedTimersPanel/sharedTimerUtils';

function getExpiryDelayMs(timer: SharedTimer, serverOffsetMs: number): number {
  return new Date(timer.fireAt).getTime() - (Date.now() + serverOffsetMs);
}

export function DashboardTimersBridge() {
  const { notify, notifyWarning } = useNotifications();
  const timersRef = useRef<Map<string, SharedTimer>>(new Map());
  const expiryTimeoutsRef = useRef<Map<string, number>>(new Map());
  const expiredTimerIdsRef = useRef<Set<string>>(new Set());
  const serverOffsetMsRef = useRef(0);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let closed = false;
    const expiryTimeouts = expiryTimeoutsRef.current;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const clearExpiryTimeout = (timerId: string) => {
      const timeoutId = expiryTimeoutsRef.current.get(timerId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        expiryTimeoutsRef.current.delete(timerId);
      }
    };

    const scheduleExpiryNotification = (timer: SharedTimer) => {
      clearExpiryTimeout(timer.id);

      const delayMs = getExpiryDelayMs(timer, serverOffsetMsRef.current);
      if (delayMs <= 0 || expiredTimerIdsRef.current.has(timer.id)) {
        return;
      }

      const timeoutId = window.setTimeout(() => {
        if (!timersRef.current.has(timer.id) || expiredTimerIdsRef.current.has(timer.id)) {
          return;
        }

        expiredTimerIdsRef.current.add(timer.id);
        notifyWarning('Timer finished', {
          message: `${formatDurationLabel(timer.durationSeconds)} timer is complete.`,
        });
      }, delayMs);

      expiryTimeoutsRef.current.set(timer.id, timeoutId);
    };

    const syncTimers = (items: SharedTimer[], serverNow: string) => {
      serverOffsetMsRef.current = getServerOffsetMs(serverNow);

      const nextTimers = new Map(items.map((item) => [item.id, item]));
      const activeTimerIds = new Set(nextTimers.keys());

      timersRef.current.forEach((_, timerId) => {
        if (!activeTimerIds.has(timerId)) {
          clearExpiryTimeout(timerId);
          expiredTimerIdsRef.current.delete(timerId);
        }
      });

      timersRef.current = nextTimers;
      nextTimers.forEach((timer) => {
        scheduleExpiryNotification(timer);
      });
    };

    const handleStarted = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;

      try {
        const payload = JSON.parse(messageEvent.data) as TimerStartedPayload;
        if (!payload.timer || !payload.serverNow) {
          return;
        }

        serverOffsetMsRef.current = getServerOffsetMs(payload.serverNow);
        timersRef.current.set(payload.timer.id, payload.timer);
        expiredTimerIdsRef.current.delete(payload.timer.id);
        scheduleExpiryNotification(payload.timer);
        window.dispatchEvent(new CustomEvent(DASHBOARD_TIMER_STARTED_EVENT, {
          detail: {
            timer: payload.timer,
            serverNow: payload.serverNow,
          },
        }));
        notify('Timer started', {
          message: `${formatDurationLabel(payload.timer.durationSeconds)} timer is now running.`,
        });
      } catch {
        return;
      }
    };

    const handleConnected = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;

      try {
        const payload = JSON.parse(messageEvent.data) as SharedTimerStreamConnectedPayload;
        if (!payload.serverNow) {
          return;
        }

        syncTimers(payload.items || [], payload.serverNow);
        window.dispatchEvent(new CustomEvent(DASHBOARD_TIMERS_CONNECTED_EVENT, {
          detail: {
            items: payload.items || [],
            serverNow: payload.serverNow,
          },
        }));
      } catch {
        return;
      }
    };

    const handleRemoved = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;

      try {
        const payload = JSON.parse(messageEvent.data) as TimerRemovedPayload;
        if (!payload.timerId || !payload.serverNow) {
          return;
        }

        serverOffsetMsRef.current = getServerOffsetMs(payload.serverNow);
        timersRef.current.delete(payload.timerId);
        expiredTimerIdsRef.current.delete(payload.timerId);
        clearExpiryTimeout(payload.timerId);
        window.dispatchEvent(new CustomEvent(DASHBOARD_TIMER_REMOVED_EVENT, {
          detail: {
            timerId: payload.timerId,
            serverNow: payload.serverNow,
          },
        }));
      } catch {
        return;
      }
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer !== null) {
        return;
      }

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 3000);
    };

    const handleError = () => {
      eventSource?.close();
      scheduleReconnect();
    };

    const connect = () => {
      eventSource = new EventSource('/api/dashboard/timers/stream');
      eventSource.addEventListener('connected', handleConnected);
      eventSource.addEventListener('timer_started', handleStarted);
      eventSource.addEventListener('timer_removed', handleRemoved);
      eventSource.addEventListener('error', handleError);
    };

    connect();

    return () => {
      closed = true;
      clearReconnectTimer();
      expiryTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      expiryTimeouts.clear();
      eventSource?.close();
    };
  }, [notify, notifyWarning]);

  return null;
}
