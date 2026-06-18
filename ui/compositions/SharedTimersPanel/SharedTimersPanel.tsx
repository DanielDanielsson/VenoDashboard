'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { SecondaryButton } from '@ui/components/SecondaryButton';
import type {
  SharedTimerMutationResponse,
  SharedTimerListResponse,
} from '@/lib/veno-api/types';
import {
  DASHBOARD_TIMER_REMOVED_EVENT,
  DASHBOARD_TIMER_STARTED_EVENT,
  DASHBOARD_TIMERS_CONNECTED_EVENT,
  type DashboardTimerRemovedDetail,
  type DashboardTimerStartedDetail,
  type DashboardTimersConnectedDetail,
} from '@ui/compositions/DashboardTimersBridge/dashboardTimerEvents';
import {
  formatDurationLabel,
  getServerOffsetMs,
  sortTimers,
  upsertTimer,
} from './sharedTimerUtils';

const TIMER_PRESETS = [5, 10, 15, 20] as const;

interface FetchErrorPayload {
  error?: {
    message?: string;
  };
}

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as T & FetchErrorPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request failed');
  }
  return payload;
};

const formatCountdown = (targetIso: string, nowMs: number): string => {
  const remaining = Math.max(
    0,
    Math.ceil((new Date(targetIso).getTime() - nowMs) / 1000),
  );
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const parseDurationInput = (value: string): number | null => {
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
    return Number.isFinite(value) && value > 0
      ? Math.round(value * 3600)
      : null;
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
  return Number.isFinite(minutes) && minutes > 0
    ? Math.round(minutes * 60)
    : null;
};

export const SharedTimersPanel = ({
  readOnly = false,
}: {
  readOnly?: boolean;
}) => {
  const [showStartForm, setShowStartForm] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(
    TIMER_PRESETS[0],
  );
  const [customValue, setCustomValue] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  const timersKey = readOnly ? null : '/api/dashboard/timers';
  const { data, error, mutate } = useSWR<SharedTimerListResponse>(
    timersKey,
    fetchJson,
    {
      revalidateOnFocus: false,
    },
  );

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

    const handleConnected = (event: Event) => {
      const customEvent = event as CustomEvent<DashboardTimersConnectedDetail>;
      const payload = customEvent.detail;
      if (!payload?.serverNow) {
        return;
      }

      setServerOffsetMs(getServerOffsetMs(payload.serverNow));
      setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
      void mutate(
        {
          items: sortTimers(payload.items || []),
          serverNow: payload.serverNow,
        },
        false,
      );
    };

    const handleStarted = (event: Event) => {
      const customEvent = event as CustomEvent<DashboardTimerStartedDetail>;
      const payload = customEvent.detail;
      if (!payload?.timer || !payload.serverNow) {
        return;
      }

      setServerOffsetMs(getServerOffsetMs(payload.serverNow));
      setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
      void mutate(
        (current) => ({
          items: upsertTimer(current?.items || [], payload.timer),
          serverNow:
            payload.serverNow || current?.serverNow || new Date().toISOString(),
        }),
        false,
      );
    };

    const handleRemoved = (event: Event) => {
      const customEvent = event as CustomEvent<DashboardTimerRemovedDetail>;
      const payload = customEvent.detail;
      if (!payload?.timerId || !payload.serverNow) {
        return;
      }

      setServerOffsetMs(getServerOffsetMs(payload.serverNow));
      setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
      void mutate(
        (current) => ({
          items: (current?.items || []).filter(
            (item) => item.id !== payload.timerId,
          ),
          serverNow:
            payload.serverNow || current?.serverNow || new Date().toISOString(),
        }),
        false,
      );
    };

    window.addEventListener(
      DASHBOARD_TIMERS_CONNECTED_EVENT,
      handleConnected as EventListener,
    );
    window.addEventListener(
      DASHBOARD_TIMER_STARTED_EVENT,
      handleStarted as EventListener,
    );
    window.addEventListener(
      DASHBOARD_TIMER_REMOVED_EVENT,
      handleRemoved as EventListener,
    );

    return () => {
      window.removeEventListener(
        DASHBOARD_TIMERS_CONNECTED_EVENT,
        handleConnected as EventListener,
      );
      window.removeEventListener(
        DASHBOARD_TIMER_STARTED_EVENT,
        handleStarted as EventListener,
      );
      window.removeEventListener(
        DASHBOARD_TIMER_REMOVED_EVENT,
        handleRemoved as EventListener,
      );
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ durationSeconds }),
      });
      const payload = (await response.json()) as SharedTimerMutationResponse &
        FetchErrorPayload;
      if (!response.ok) {
        throw new Error(payload.error?.message || 'Failed to start timer');
      }

      setServerOffsetMs(getServerOffsetMs(payload.serverNow));
      setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
      await mutate(
        (current) => ({
          items: upsertTimer(current?.items || [], payload.timer),
          serverNow: payload.serverNow,
        }),
        false,
      );
      setCustomValue('');
      setCustomError(null);
      setShowStartForm(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Failed to start timer',
      );
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
      method: 'DELETE',
    });
    const payload = (await response.json()) as SharedTimerMutationResponse &
      FetchErrorPayload;
    if (!response.ok) {
      setActionError(payload.error?.message || 'Failed to remove timer');
      return;
    }

    setServerOffsetMs(getServerOffsetMs(payload.serverNow));
    setNowMs(Date.now() + getServerOffsetMs(payload.serverNow));
    await mutate(
      (current) => ({
        items: (current?.items || []).filter((item) => item.id !== timerId),
        serverNow: payload.serverNow,
      }),
      false,
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
    <DashboardPanel title="Timers">
      <div className="flex flex-1 flex-col">
        {timers.length === 0 && !showStartForm ? (
          <p className="body_text text-text-dim">No active timers</p>
        ) : (
          <div className="flex flex-col gap-2">
            {timers.map((timer) => {
              const remaining = Math.max(
                0,
                new Date(timer.fireAt).getTime() - nowMs,
              );
              const isDone = remaining <= 0;

              return (
                <div
                  key={timer.id}
                  className="flex items-center justify-between gap-3 rounded-[4px] border border-border bg-surface-muted px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="ui_caption text-text-dim">
                      {formatDurationLabel(timer.durationSeconds)}
                    </p>
                    <p
                      className={
                        isDone
                          ? 'ui_mono_text_strong tabular-nums text-base-warning-dark'
                          : 'ui_mono_text_strong tabular-nums text-text'
                      }
                    >
                      {isDone ? 'Done' : formatCountdown(timer.fireAt, nowMs)}
                    </p>
                  </div>
                  <SecondaryButton
                    disabled={readOnly}
                    onClick={() => void removeTimer(timer.id)}
                  >
                    Remove
                  </SecondaryButton>
                </div>
              );
            })}
          </div>
        )}

        {showStartForm && !readOnly ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {TIMER_PRESETS.map((minutes) => (
                <SecondaryButton
                  key={minutes}
                  isActive={selectedMinutes === minutes}
                  onClick={() => setSelectedMinutes(minutes)}
                >
                  {minutes}m
                </SecondaryButton>
              ))}
            </div>
            <input
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder="Custom (5, mm:ss, 90s)"
              className="ui_input_text w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-text outline-none placeholder:text-text-dim focus:border-border"
            />
            {customError && (
              <p className="ui_caption text-base-error-dark">{customError}</p>
            )}
            {errorMessage && (
              <p className="ui_caption text-base-error-dark">{errorMessage}</p>
            )}
            <div className="flex gap-2">
              <SecondaryButton
                twStyles="flex-1 justify-center py-2.5"
                isActive
                disabled={isSubmitting}
                onClick={() =>
                  customValue
                    ? applyCustomStart()
                    : void startTimer(selectedMinutes * 60)
                }
              >
                {isSubmitting
                  ? 'Starting…'
                  : `Start ${customValue ? 'custom' : `${selectedMinutes}m`}`}
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  setShowStartForm(false);
                  setCustomValue('');
                  setCustomError(null);
                }}
              >
                Cancel
              </SecondaryButton>
            </div>
          </div>
        ) : (
          <SecondaryButton
            twStyles="mt-4 w-full justify-center"
            disabled={readOnly}
            onClick={() => setShowStartForm(true)}
          >
            {readOnly ? 'Admin sign in to start timers' : '+ Start Timer'}
          </SecondaryButton>
        )}
      </div>
    </DashboardPanel>
  );
};
