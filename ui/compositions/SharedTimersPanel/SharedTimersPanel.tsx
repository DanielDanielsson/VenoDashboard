'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { DashboardPanel } from '@ui/components/DashboardPanel';
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

export function SharedTimersPanel({ readOnly = false }: { readOnly?: boolean }) {
  const [showStartForm, setShowStartForm] = useState(false);
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
    if (readOnly) {
      return;
    }

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
  }, [mutate, readOnly]);

  const timers = useMemo(() => sortTimers(data?.items || []), [data?.items]);

  async function startTimer(durationSeconds: number) {
    if (readOnly) {
      return;
    }

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
      setShowStartForm(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to start timer');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeTimer(timerId: string) {
    if (readOnly) {
      return;
    }

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
    <DashboardPanel
      title="Timers"
      headerRight={
        <span className="text-xs text-(--text-dim)">{timers.length} total</span>
      }
    >
      <div className="flex flex-1 flex-col">
        {timers.length === 0 && !showStartForm ? (
          <p className="text-sm text-(--text-dim)">No active timers</p>
        ) : (
          <div className="flex flex-col gap-2">
            {timers.map((timer) => {
              const remaining = Math.max(0, new Date(timer.fireAt).getTime() - nowMs);
              const isDone = remaining <= 0;

              return (
                <div key={timer.id} className="flex items-center justify-between gap-3 rounded-lg border border-(--border) bg-(--surface-muted) px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs text-(--text-dim)">{formatDurationLabel(timer.durationSeconds)}</p>
                    <p className={`text-base font-semibold tabular-nums ${isDone ? 'text-amber-200' : 'text-(--text)'}`}>
                      {isDone ? 'Done' : formatCountdown(timer.fireAt, nowMs)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button-ghost shrink-0 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={readOnly}
                    onClick={() => void removeTimer(timer.id)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {showStartForm && !readOnly ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
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
            </div>
            <input
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder="Custom (5, mm:ss, 90s)"
              className="w-full rounded-lg border border-(--border) bg-(--surface-muted) px-3 py-2 text-sm text-(--text) outline-none placeholder:text-(--text-dim) focus:border-(--border-focus, var(--border))"
            />
            {customError && <p className="text-xs text-rose-300">{customError}</p>}
            {errorMessage && <p className="text-xs text-rose-300">{errorMessage}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                className="button-primary flex-1"
                disabled={isSubmitting}
                onClick={() => customValue ? applyCustomStart() : void startTimer(selectedMinutes * 60)}
              >
                {isSubmitting ? 'Starting…' : `Start ${customValue ? 'custom' : `${selectedMinutes}m`}`}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => { setShowStartForm(false); setCustomValue(''); setCustomError(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-4 w-full rounded-lg border border-dashed border-(--border) py-3 text-sm text-(--text-dim) transition-colors hover:border-(--text-soft) hover:text-(--text-soft) disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-(--border) disabled:hover:text-(--text-dim)"
            disabled={readOnly}
            onClick={() => setShowStartForm(true)}
          >
            {readOnly ? 'Owner sign in to start timers' : '+ Start Timer'}
          </button>
        )}
      </div>
    </DashboardPanel>
  );
}
