'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationEvent } from '@/lib/pulse-api/types';

interface ConnectedEventPayload {
  cursor?: number | string | null;
}

function parseCursor(data: string): number | null {
  try {
    const payload = JSON.parse(data) as ConnectedEventPayload;
    if (typeof payload.cursor === 'number') {
      return payload.cursor;
    }
    if (typeof payload.cursor === 'string') {
      const value = Number(payload.cursor);
      return Number.isFinite(value) ? value : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function DashboardNotificationsBridge() {
  const router = useRouter();
  const lastSeqRef = useRef(0);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let closed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const handleConnected = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;
      const cursor = parseCursor(messageEvent.data);
      if (cursor !== null) {
        lastSeqRef.current = Math.max(lastSeqRef.current, cursor);
      }
    };

    const handleNotification = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;

      try {
        const notification = JSON.parse(messageEvent.data) as NotificationEvent;
        if (typeof notification.seq === 'number') {
          lastSeqRef.current = Math.max(lastSeqRef.current, notification.seq);
        }

        window.dispatchEvent(new CustomEvent('pulse-notification', { detail: notification }));

        if (notification.type.startsWith('settings.')) {
          window.dispatchEvent(new CustomEvent('pulse-settings-updated', { detail: notification }));
          router.refresh();
        }
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
      const params = new URLSearchParams();
      if (lastSeqRef.current > 0) {
        params.set('afterSeq', String(lastSeqRef.current));
      }

      const url = params.size > 0 ? `/api/dashboard/notifications/stream?${params.toString()}` : '/api/dashboard/notifications/stream';
      eventSource = new EventSource(url);
      eventSource.addEventListener('connected', handleConnected);
      eventSource.addEventListener('notification', handleNotification);
      eventSource.addEventListener('error', handleError);
    };

    connect();

    return () => {
      closed = true;
      clearReconnectTimer();
      eventSource?.close();
    };
  }, [router]);

  return null;
}
