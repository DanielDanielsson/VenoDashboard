'use client';

import { useEffect, useId, useState } from 'react';

type TrendDirection = 'up' | 'up-slight' | 'stable' | 'down-slight' | 'down';
type IndicatorSize = 'sm' | 'md' | 'lg';
interface GlucoseIndicatorProps {
  value: number;
  trend: string;
  size?: IndicatorSize;
  unit?: string;
  timestamp?: string;
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
    strokeWidth: 4,
    fontSize: 20,
    unitSize: 11,
    ageSize: 10,
    pointerLength: 10,
    pointerWidth: 15,
    innerRadius: 26,
    arrowOverlap: 7
  },
  md: {
    outer: 146,
    strokeWidth: 6,
    fontSize: 28,
    unitSize: 12,
    ageSize: 11,
    pointerLength: 12,
    pointerWidth: 19,
    innerRadius: 35,
    arrowOverlap: 9
  },
  lg: {
    outer: 184,
    strokeWidth: 8,
    fontSize: 40,
    unitSize: 13,
    ageSize: 12,
    pointerLength: 14,
    pointerWidth: 23,
    innerRadius: 46,
    arrowOverlap: 11
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
  if (s.includes('rising') || s.includes('singleup') || s === 'up') return 'up-slight';
  if (s.includes('fallingfast') || s.includes('doubledown') || s === 'fallingquickly') return 'down';
  if (s.includes('falling') || s.includes('singledown') || s === 'down') return 'down-slight';
  return 'stable';
}

function formatAge(timestamp: string, nowMs: number): string {
  const age = nowMs - new Date(timestamp).getTime();
  const minutes = Math.round(age / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1m ago';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function trendAngleDeg(dir: TrendDirection): number {
  const map: Record<TrendDirection, number> = {
    up: -90,
    'up-slight': -45,
    stable: 0,
    'down-slight': 45,
    down: 90
  };
  return map[dir];
}

/**
 * Builds the integrated-path shape: an open circle arc with an arrowhead
 * at the given angle. The arc goes the SHORT way around (leaving a gap
 * where the arrow sits), so the arrow appears as a separate chevron
 * attached to the circle boundary.
 */
function buildIntegratedPath(
  cx: number,
  outerR: number,
  pLen: number,
  pWidth: number,
  angleDeg: number,
  overlap: number
): string {
  const a = (angleDeg * Math.PI) / 180;
  const bR = outerR - overlap;

  const tipX = cx + (outerR + pLen - overlap) * Math.cos(a);
  const tipY = cx + (outerR + pLen - overlap) * Math.sin(a);

  const a1 = a - Math.atan2(pWidth / 2, bR);
  const a2 = a + Math.atan2(pWidth / 2, bR);

  const b1x = cx + bR * Math.cos(a1);
  const b1y = cx + bR * Math.sin(a1);
  const b2x = cx + bR * Math.cos(a2);
  const b2y = cx + bR * Math.sin(a2);

  // Calculate the angular gap to decide arc direction.
  let angleDiff = a2 - a1;
  if (angleDiff < 0) angleDiff += 2 * Math.PI;
  const largeArcFlag = angleDiff > Math.PI ? 1 : 0;

  return `M ${tipX} ${tipY} L ${b1x} ${b1y} A ${bR} ${bR} 0 ${largeArcFlag} 1 ${b2x} ${b2y} Z`;
}

export function GlucoseIndicator({
  value,
  trend,
  size = 'lg',
  unit = 'mmol/L',
  timestamp
}: GlucoseIndicatorProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const uid = useId().replace(/:/g, '-');

  const isStale = timestamp
    ? nowMs - new Date(timestamp).getTime() > STALE_MS
    : false;

  const range = classifyRange(value);
  const direction = normalizeTrend(trend);
  const color = isStale ? STALE_COLOR[theme] : RANGE_COLORS[range][theme];
  const cfg = SIZE_CONFIG[size];

  const cx = cfg.outer / 2;
  const outerR = (cfg.outer - cfg.pointerLength * 2 - cfg.strokeWidth * 2) / 2;
  const angleDeg = trendAngleDeg(direction);
  const sw = cfg.strokeWidth / 2;

  const path = buildIntegratedPath(cx, outerR, cfg.pointerLength, cfg.pointerWidth, angleDeg, cfg.arrowOverlap);

  const displayValue = isStale ? '--' : value.toFixed(1);
  const textFill = theme === 'dark' ? '#f1f5f9' : color;
  const staleGlowId = `${uid}-sg`;

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
      <svg
        width={cfg.outer}
        height={cfg.outer}
        viewBox={`0 0 ${cfg.outer} ${cfg.outer}`}
        style={{ overflow: 'visible' }}
      >
        {isStale && (
          <defs>
            <filter id={staleGlowId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}

        {/* Outlined circle + arrow */}
        {isStale ? (
          <>
            <circle
              cx={cx}
              cy={cx}
              r={outerR}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              filter={`url(#${staleGlowId})`}
            />
          </>
        ) : (
          <path
            d={path}
            fill="transparent"
            stroke={color}
            strokeWidth={sw}
          />
        )}

        {/* Inner circle */}
        <circle
          cx={cx}
          cy={cx}
          r={cfg.innerRadius}
          fill="transparent"
          stroke={isStale ? color : color}
          strokeWidth={sw}
          filter={isStale ? `url(#${staleGlowId})` : undefined}
        />

        {/* Value */}
        <text
          x={cx}
          y={cx}
          textAnchor="middle"
          dominantBaseline="central"
          fill={isStale ? 'rgba(241,245,249,0.6)' : textFill}
          fontSize={cfg.fontSize}
          fontWeight={700}
          fontFamily="var(--font-plex-mono), monospace"
          style={{ letterSpacing: '-0.04em' }}
        >
          {displayValue}
        </text>
      </svg>

      <span style={{
        fontSize: cfg.unitSize,
        color: 'var(--text-soft)',
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase'
      }}>
        {unit}
      </span>
      {timestamp && (
        <span style={{ fontSize: cfg.ageSize, color: 'var(--text-dim)' }}>
          {formatAge(timestamp, nowMs)}
        </span>
      )}
    </div>
  );
}
