'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import type {
  SharedTimer,
  SharedTimerMutationResponse,
  SharedTimerListResponse,
  TimerRemovedPayload,
  TimerStartedPayload,
  SharedTimerStreamConnectedPayload
} from '@/lib/pulse-api/types';

const TIMER_PRESETS = [5, 10, 15, 20] as const;

interface FetchErrorPayload {
  error?: {
    message?: string;
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as T & FetchErrorPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request failed');
  }
  return payload;
}

function formatDurationLabel(totalSeconds: number): string {
  const seconds = Math.max(1, Math.round(totalSeconds));
  if (seconds % 3600 === 0) {
    return `${seconds / 3600}h`;
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  return `${seconds}s`;
}

function formatCountdown(targetIso: string, nowMs: number): string {
  const remaining = Math.max(0, Math.ceil((new Date(targetIso).getTime() - nowMs) / 1000));
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getServerOffsetMs(serverNow: string): number {
  return new Date(serverNow).getTime() - Date.now();
}

function parseDurationInput(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((part) => Number(part));
    if (parts.some((part) => !Number.isInteger(part) || part < 0)) {
      return null;
    }
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      if (seconds >= 60) {
        return null;
      }
      return minutes * 60 + seconds || null;
    }
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      if (minutes >= 60 || seconds >= 60) {
        return null;
      }
      return hours * 3600 + minutes * 60 + seconds || null;
    }
    return null;
  }

  if (trimmed.endsWith('h')) {
    const value = Number(trimmed.slice(0, -1));
    return Number.isFinite(value) && value > 0 ? Math.round(value * 3600) : null;
  }
  if (trimmed.endsWith('m')) {
    const value = Number(trimmed.slice(0, -1));
    return Number.isFinite(value) && value > 0 ? Math.round(value * 60) : null;
  }
  if (trimmed.endsWith('s')) {
    const value = Number(trimmed.slice(0, -1));
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }

  const minutes = Number(trimmed);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
}

function sortTimers(items: SharedTimer[]): SharedTimer[] {
  return [...items].sort((left, right) => {
    const fireDiff = new Date(left.fireAt).getTime() - new Date(right.fireAt).getTime();
    if (fireDiff !== 0) {
      return fireDiff;
    }
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function upsertTimer(items: SharedTimer[], timer: SharedTimer): SharedTimer[] {
  const nextItems = items.filter((item) => item.id !== timer.id);
  nextItems.push(timer);
  return sortTimers(nextItems);
}

export function SharedTimersPanel() {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(TIMER_PRESETS[0]);
  const [customValue, setCustomValue] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  const { data, error, mutate } = useSWR<SharedTimerListResponse>('/api/dashboard/timers', fetchJson, {
    revalidateOnFocus: false
  });

  useEffect(() => {
    if (data?.serverNow) {
      setServerOffsetMs(getServerOffsetMs(data.serverNow));
    }
  }, [data?.serverNow]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now() + serverOffsetMs);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [serverOffsetMs]);

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

    const scheduleReconnect = () => {
      if (closed || reconnectTimer !== null) {
        return;
      }

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 3000);
    };

    const handleConnected = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;

      try {
        const payload = JSON.parse(messageEvent.data) as SharedTimerStreamConnectedPayload;
        setServerOffsetMs(getServerOffsetMs(payload.serverNow));
        setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
        void mutate({ items: sortTimers(payload.items || []), serverNow: payload.serverNow }, false);
      } catch {
        return;
      }
    };

    const handleStarted = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;

      try {
        const payload = JSON.parse(messageEvent.data) as TimerStartedPayload;
        if (!payload.timer || !payload.serverNow) {
          return;
        }

        setServerOffsetMs(getServerOffsetMs(payload.serverNow));
        setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
        void mutate(
          (current) => ({
            items: upsertTimer(current?.items || [], payload.timer as SharedTimer),
            serverNow: payload.serverNow || current?.serverNow || new Date().toISOString()
          }),
          false
        );
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

        setServerOffsetMs(getServerOffsetMs(payload.serverNow));
        setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
        void mutate(
          (current) => ({
            items: (current?.items || []).filter((item) => item.id !== payload.timerId),
            serverNow: payload.serverNow || current?.serverNow || new Date().toISOString()
          }),
          false
        );
      } catch {
        return;
      }
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
      eventSource?.close();
    };
  }, [mutate]);

  const timers = useMemo(() => sortTimers(data?.items || []), [data?.items]);

  async function startTimer(durationSeconds: number) {
    setIsSubmitting(true);
    setActionError(null);

    try {
      const response = await fetch('/api/dashboard/timers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ durationSeconds })
      });
      const payload = (await response.json()) as SharedTimerMutationResponse & FetchErrorPayload;
      if (!response.ok) {
        throw new Error(payload.error?.message || 'Failed to start timer');
      }

      setServerOffsetMs(getServerOffsetMs(payload.serverNow));
      setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
      await mutate(
        (current) => ({
          items: upsertTimer(current?.items || [], payload.timer),
          serverNow: payload.serverNow
        }),
        false
      );
      setCustomValue('');
      setCustomError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to start timer');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeTimer(timerId: string) {
    setActionError(null);

    const response = await fetch(`/api/dashboard/timers/${timerId}`, {
      method: 'DELETE'
    });
    const payload = (await response.json()) as SharedTimerMutationResponse & FetchErrorPayload;
    if (!response.ok) {
      setActionError(payload.error?.message || 'Failed to remove timer');
      return;
    }

    setServerOffsetMs(getServerOffsetMs(payload.serverNow));
    setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
    await mutate(
      (current) => ({
        items: (current?.items || []).filter((item) => item.id !== timerId),
        serverNow: payload.serverNow
      }),
      false
    );
  }

  function applyCustomStart() {
    const durationSeconds = parseDurationInput(customValue);
    if (!durationSeconds) {
      setCustomError('Use minutes, mm:ss, hh:mm:ss, or 90s');
      return;
    }

    setCustomError(null);
    void startTimer(durationSeconds);
  }

  const errorMessage = error instanceof Error ? error.message : actionError;

  return (
    <section className="panel dashboard-section">
      <div className="dashboard-section__header">
        <div>
          <p className="kicker">Shared timers</p>
          <h2 className="dashboard-section__title">Timers</h2>
          <p className="dashboard-section__meta">Starts here are shared with all connected consumer apps.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {TIMER_PRESETS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={selectedMinutes === minutes ? 'button-primary' : 'button-secondary'}
            onClick={() => setSelectedMinutes(minutes)}
          >
            {minutes}m
          </button>
        ))}
        <button
          type="button"
          className="button-primary"
          disabled={isSubmitting}
          onClick={() => void startTimer(selectedMinutes * 60)}
        >
          {isSubmitting ? 'Starting...' : `Start ${selectedMinutes}m`}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          placeholder="Custom (min, mm:ss, hh:mm:ss, 90s)"
          className="min-w-[18rem] flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
        />
        <button type="button" className="button-secondary" disabled={isSubmitting} onClick={applyCustomStart}>
          Start custom
        </button>
      </div>

      {customError ? <p className="mt-3 text-sm text-rose-300">{customError}</p> : null}
      {errorMessage ? <p className="mt-3 text-sm text-rose-300">{errorMessage}</p> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {timers.length === 0 ? (
          <div className="dashboard-stat-card md:col-span-2">
            <p className="text-sm text-[var(--text-dim)]">No active shared timers.</p>
          </div>
        ) : (
          timers.map((timer) => {
            const remaining = Math.max(0, new Date(timer.fireAt).getTime() - nowMs);
            const isDone = remaining <= 0;

            return (
              <article key={timer.id} className="dashboard-stat-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Shared timer</p>
                    <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">{formatDurationLabel(timer.durationSeconds)}</h3>
                    <p className="mt-2 text-sm text-[var(--text-dim)]">
                      Started {new Date(timer.createdAt).toLocaleTimeString()}
                    </p>
                    <p className={`mt-3 text-lg font-semibold ${isDone ? 'text-amber-200' : 'text-[var(--text)]'}`}>
                      {isDone ? 'Done' : formatCountdown(timer.fireAt, nowMs)}
                    </p>
                  </div>
                  <button type="button" className="button-secondary" onClick={() => void removeTimer(timer.id)}>
                    Remove
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
