'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../../base/Icon';

type IndicatorSize = 'sm' | 'md' | 'lg';
type TrendDirection = 'up' | 'up-slight' | 'stable' | 'down-slight' | 'down';
interface GlucoseIndicatorProps {
  value: number;
  trend: string;
  size?: IndicatorSize;
  unit?: string;
  timestamp?: string;
  showAge?: boolean;
}

const STALE_MS = 15 * 60 * 1000;

const RANGE_COLORS = {
  low: { dark: '#ef4444', light: '#dc2626' },
  normal: { dark: '#10b981', light: '#059669' },
  high: { dark: '#eab308', light: '#ca8a04' }
} as const;

const STALE_COLOR = { dark: 'rgba(248,250,252,0.25)', light: '#94a3b8' } as const;

const SIZE_CONFIG = {
  sm: {
    outer: 112,
    fontSize: 20,
    unitClassName: 'ui_mono_unit',
    ageClassName: 'ui_caption'
  },
  md: {
    outer: 146,
    fontSize: 28,
    unitClassName: 'ui_mono_unit',
    ageClassName: 'ui_caption'
  },
  lg: {
    outer: 184,
    fontSize: 40,
    unitClassName: 'ui_mono_unit',
    ageClassName: 'ui_caption'
  }
} as const;

function classifyRange(value: number): 'low' | 'normal' | 'high' {
  if (value < 4.0) return 'low';
  if (value > 10.0) return 'high';
  return 'normal';
}

function normalizeTrend(trend: string): TrendDirection {
  const s = trend.toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('risingfast') || s.includes('doubleup') || s === 'risingquickly') return 'up';
  if (s.includes('rising') || s.includes('singleup') || s === 'up' || s === 'fortyfiveup') return 'up-slight';
  if (s.includes('fallingfast') || s.includes('doubledown') || s === 'fallingquickly') return 'down';
  if (s.includes('falling') || s.includes('singledown') || s === 'down' || s === 'fortyfivedown') return 'down-slight';
  return 'stable';
}

const TREND_ROTATION: Record<TrendDirection, number> = {
  up: -90,
  'up-slight': -45,
  stable: 0,
  'down-slight': 45,
  down: 90
};

/** Circle center as a fraction of the SVG viewBox (0 0 184 153) */
const CIRCLE_CENTER_X = 76 / 184;
const CIRCLE_CENTER_Y = 76 / 153;

function formatAge(timestamp: string, nowMs: number): string {
  const age = nowMs - new Date(timestamp).getTime();
  const minutes = Math.round(age / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1m ago';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export function GlucoseIndicator({
  value,
  trend,
  size = 'lg',
  unit = 'mmol/L',
  timestamp,
  showAge = true,
}: GlucoseIndicatorProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isStale = timestamp
    ? nowMs - new Date(timestamp).getTime() > STALE_MS
    : false;

  const range = classifyRange(value);
  const direction = normalizeTrend(trend);
  const color = isStale ? STALE_COLOR[theme] : RANGE_COLORS[range][theme];
  const cfg = SIZE_CONFIG[size];
  const rotation = TREND_ROTATION[direction];

  const displayValue = isStale ? '--' : value.toFixed(1);
  const textFill = theme === 'dark' ? '#f1f5f9' : color;

  useEffect(() => {
    const apply = () => {
      setTheme(document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light');
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!timestamp) return;

    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [timestamp]);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: cfg.outer, height: cfg.outer }}>
        <div style={{
          color,
          opacity: isStale ? 0.4 : 1,
          width: cfg.outer,
          height: cfg.outer,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${CIRCLE_CENTER_X * 100}% ${CIRCLE_CENTER_Y * 100}%`,
          transition: 'transform 0.3s ease'
        }}>
          <Icon
            icon="glucose"
            twStyles="block w-full h-full"
            title="Glucose indicator"
          />
        </div>
        <span style={{
          position: 'absolute',
          top: `${CIRCLE_CENTER_Y * 100}%`,
          left: `${CIRCLE_CENTER_X * 100}%`,
          transform: 'translate(-50%, -50%)',
          fontSize: cfg.fontSize,
          color: isStale ? 'rgba(241,245,249,0.6)' : textFill,
          fontWeight: 700,
          fontFamily: 'var(--font-plex-mono), monospace',
          letterSpacing: '-0.04em'
        }}>
          {displayValue}
        </span>
      </div>

      <span className={cfg.unitClassName} style={{ color: 'var(--text-soft)' }}>
        {unit}
      </span>
      {showAge && timestamp && (
        <span className={cfg.ageClassName} style={{ color: 'var(--text-dim)' }}>
          {formatAge(timestamp, nowMs)}
        </span>
      )}
    </div>
  );
}
