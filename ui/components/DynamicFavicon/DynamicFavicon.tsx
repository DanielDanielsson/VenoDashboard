'use client';

import { useEffect } from 'react';
import { getGlucoseColor, type GlucoseColorMode } from '@/lib/glucose/tints';

const COLOR_MODE_KEY = 'pulse-glucose-chart-color-mode';

function getColorMode(): GlucoseColorMode {
  try {
    const stored = localStorage.getItem(COLOR_MODE_KEY);
    return stored === 'gradient' || stored === 'threeColors' ? stored : 'gradient';
  } catch {
    return 'gradient';
  }
}

function drawFaviconDataUrl(valueMmolL: number): string {
  const color = getGlucoseColor(valueMmolL, getColorMode());
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
    fetch('/api/dashboard/glucose/history?limit=1')
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (json?.latest?.valueMmolL != null) {
          setFavicon(drawFaviconDataUrl(json.latest.valueMmolL));
        }
      })
      .catch(() => {});

    function handleGlucoseUpdate(e: Event) {
      const detail = (e as CustomEvent<{ valueMmolL: number }>).detail;
      if (detail?.valueMmolL != null) {
        setFavicon(drawFaviconDataUrl(detail.valueMmolL));
      }
    }

    window.addEventListener('pulse-glucose-latest', handleGlucoseUpdate);
    return () => window.removeEventListener('pulse-glucose-latest', handleGlucoseUpdate);
  }, []);

  return null;
}
