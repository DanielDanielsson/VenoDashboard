'use client';

import { useEffect } from 'react';
import { getGlucoseColor, type GlucoseColorMode } from '@/lib/glucose/tints';

const COLOR_MODE_KEY = 'pulse-glucose-chart-color-mode';
const FAVICON_STALE_MS = 6 * 60 * 1000;
const STALE_FAVICON_COLOR = '#ffffff';

interface LatestReading {
  valueMmolL: number;
  timestamp: string;
}

function getColorMode(): GlucoseColorMode {
  try {
    const stored = localStorage.getItem(COLOR_MODE_KEY);
    return stored === 'gradient' || stored === 'threeColors' ? stored : 'gradient';
  } catch {
    return 'gradient';
  }
}

function getReadingAgeMs(timestamp: string, nowMs = Date.now()): number {
  const readingMs = new Date(timestamp).getTime();
  return Number.isFinite(readingMs) ? nowMs - readingMs : Number.POSITIVE_INFINITY;
}

export function isDynamicFaviconReadingStale(timestamp: string, nowMs = Date.now()): boolean {
  return getReadingAgeMs(timestamp, nowMs) > FAVICON_STALE_MS;
}

function drawFaviconDataUrl(valueMmolL: number, colorOverride?: string): string {
  const color = colorOverride ?? getGlucoseColor(valueMmolL, getColorMode());
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = size / 2;
  const cy = size / 2;
  const radius = 13;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  return canvas.toDataURL('image/png');
}

function setFavicon(dataUrl: string) {
  if (!dataUrl) return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = dataUrl;
}

export function DynamicFavicon() {
  useEffect(() => {
    let latestReading: LatestReading | null = null;
    let staleTimeoutId: number | null = null;

    function clearStaleTimeout() {
      if (staleTimeoutId == null) return;
      window.clearTimeout(staleTimeoutId);
      staleTimeoutId = null;
    }

    function renderFavicon() {
      if (!latestReading) return;

      clearStaleTimeout();

      if (isDynamicFaviconReadingStale(latestReading.timestamp)) {
        setFavicon(drawFaviconDataUrl(latestReading.valueMmolL, STALE_FAVICON_COLOR));
        return;
      }

      setFavicon(drawFaviconDataUrl(latestReading.valueMmolL));

      const remainingMs = FAVICON_STALE_MS - getReadingAgeMs(latestReading.timestamp);
      staleTimeoutId = window.setTimeout(() => {
        if (!latestReading) return;
        setFavicon(drawFaviconDataUrl(latestReading.valueMmolL, STALE_FAVICON_COLOR));
      }, Math.max(remainingMs, 0) + 1);
    }

    function updateReading(reading: LatestReading) {
      latestReading = reading;
      renderFavicon();
    }

    fetch('/api/dashboard/glucose/history?limit=1')
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (json?.latest?.valueMmolL != null && json?.latest?.timestamp) {
          updateReading({
            valueMmolL: json.latest.valueMmolL,
            timestamp: json.latest.timestamp,
          });
        }
      })
      .catch(() => {});

    function handleGlucoseUpdate(e: Event) {
      const detail = (e as CustomEvent<LatestReading>).detail;
      if (detail?.valueMmolL != null && detail?.timestamp) {
        updateReading(detail);
      }
    }

    window.addEventListener('pulse-glucose-latest', handleGlucoseUpdate);
    return () => {
      clearStaleTimeout();
      window.removeEventListener('pulse-glucose-latest', handleGlucoseUpdate);
    };
  }, []);

  return null;
}
