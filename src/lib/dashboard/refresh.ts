import type { HistoryWindow } from '@/lib/glucose/history-cache';

export const DASHBOARD_REFRESH_OFF = '';
export const DASHBOARD_REFRESH_AUTO = 'auto';
export const DEFAULT_DASHBOARD_AUTO_REFRESH_INTERVALS = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h'];

const MIN_AUTO_REFRESH_MS = 5_000;
const MAX_AUTO_REFRESH_MS = 60_000;

export function parseRefreshIntervalMs(value: string): number | null {
  const match = /^(\d+)(s|m|h)$/.exec(value);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (unit === 's') {
    return amount * 1_000;
  }

  if (unit === 'm') {
    return amount * 60_000;
  }

  return amount * 3_600_000;
}

export function getAutoRefreshIntervalMs(
  window: HistoryWindow | null,
  viewportWidth: number,
): number {
  if (!window) {
    return MAX_AUTO_REFRESH_MS;
  }

  const rangeMs = new Date(window.to).getTime() - new Date(window.from).getTime();
  if (!Number.isFinite(rangeMs) || rangeMs <= 0) {
    return MAX_AUTO_REFRESH_MS;
  }

  const roughInterval = rangeMs / Math.max(1, viewportWidth);
  return Math.min(MAX_AUTO_REFRESH_MS, Math.max(MIN_AUTO_REFRESH_MS, Math.round(roughInterval)));
}

export function resolveRefreshIntervalMs(
  refresh: string,
  window: HistoryWindow | null,
  viewportWidth: number,
): number | null {
  if (refresh === DASHBOARD_REFRESH_OFF) {
    return null;
  }

  if (refresh === DASHBOARD_REFRESH_AUTO) {
    return getAutoRefreshIntervalMs(window, viewportWidth);
  }

  return parseRefreshIntervalMs(refresh);
}
