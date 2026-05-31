'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { twMerge } from 'tailwind-merge';
import { getGlucoseColor, type GlucoseColorMode } from '@/lib/glucose/tints';
import { Icon } from '../../base/Icon';

type IndicatorSize = 'sm' | 'md' | 'lg';
type TrendDirection = 'up' | 'up-slight' | 'stable' | 'down-slight' | 'down';
interface GlucoseIndicatorProps {
  value: number;
  trend: string;
  displayValue?: string;
  size?: IndicatorSize;
  unit?: string;
  timestamp?: string;
  showAge?: boolean;
  showUnit?: boolean;
  fitToContainer?: boolean;
  fitPlacement?: CSSProperties['placeItems'];
  colorMode?: GlucoseColorMode;
}

const STALE_MS = 15 * 60 * 1000;

const STALE_COLOR = {
  dark: 'rgb(248 250 252 / 0.25)',
  light: 'var(--color-base-ink-soft)',
} as const;

const SIZE_CONFIG = {
  sm: {
    outer: 112,
    fontSize: 20,
    unitClassName: 'ui_mono_unit',
    ageClassName: 'ui_caption',
  },
  md: {
    outer: 146,
    fontSize: 28,
    unitClassName: 'ui_mono_unit',
    ageClassName: 'ui_caption',
  },
  lg: {
    outer: 184,
    fontSize: 40,
    unitClassName: 'ui_mono_unit',
    ageClassName: 'ui_caption',
  },
} as const;

const FIT_CONTAINER_STYLES: CSSProperties & {
  '--glucose-indicator-size': string;
  '--glucose-indicator-value-font-size': string;
  '--glucose-indicator-gap': string;
  '--glucose-indicator-unit-font-size': string;
} = {
  '--glucose-indicator-size':
    'clamp(4rem, min(72cqw, calc((100cqh - 1.35rem) * 0.84)), 40rem)',
  '--glucose-indicator-value-font-size':
    'clamp(1.1rem, min(15cqw, 16cqh), 10rem)',
  '--glucose-indicator-gap': 'clamp(0.35rem, 2.5cqh, 1.5rem)',
  '--glucose-indicator-unit-font-size':
    'clamp(0.58rem, min(4.8cqw, 4.8cqh), 1.8rem)',
  display: 'grid',
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
  placeItems: 'center',
  width: '100%',
};

const FIT_CONTAINER_COMPACT_LABEL_STYLES = {
  '--glucose-indicator-size': 'clamp(4rem, min(92cqw, 92cqh), 40rem)',
  '--glucose-indicator-value-font-size':
    'clamp(1.1rem, min(18cqw, 19cqh), 10rem)',
} satisfies Pick<
  typeof FIT_CONTAINER_STYLES,
  '--glucose-indicator-size' | '--glucose-indicator-value-font-size'
>;

const normalizeTrend = (trend: string): TrendDirection => {
  const s = trend.toLowerCase().replace(/[^a-z]/g, '');
  if (
    s.includes('risingfast') ||
    s.includes('doubleup') ||
    s === 'risingquickly'
  )
    return 'up';
  if (
    s.includes('rising') ||
    s.includes('singleup') ||
    s === 'up' ||
    s === 'fortyfiveup'
  )
    return 'up-slight';
  if (
    s.includes('fallingfast') ||
    s.includes('doubledown') ||
    s === 'fallingquickly'
  )
    return 'down';
  if (
    s.includes('falling') ||
    s.includes('singledown') ||
    s === 'down' ||
    s === 'fortyfivedown'
  )
    return 'down-slight';
  return 'stable';
};

const TREND_ROTATION: Record<TrendDirection, number> = {
  up: -90,
  'up-slight': -45,
  stable: 0,
  'down-slight': 45,
  down: 90,
};

/** Circle center as a fraction of the SVG viewBox (0 0 184 153) */
const CIRCLE_CENTER_X = 76 / 184;
const CIRCLE_CENTER_Y = 76 / 153;

const formatAge = (timestamp: string, nowMs: number): string => {
  const age = nowMs - new Date(timestamp).getTime();
  const minutes = Math.round(age / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1m ago';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
};

export const GlucoseIndicator = ({
  value,
  trend,
  displayValue,
  size = 'lg',
  unit = 'mmol/L',
  timestamp,
  showAge = true,
  showUnit = true,
  fitToContainer = false,
  fitPlacement = 'center',
  colorMode = 'standard',
}: GlucoseIndicatorProps) => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isStale = timestamp
    ? nowMs - new Date(timestamp).getTime() > STALE_MS
    : false;

  const direction = normalizeTrend(trend);
  const color = isStale
    ? STALE_COLOR[theme]
    : getGlucoseColor(value, colorMode, 1, theme === 'dark');
  const cfg = SIZE_CONFIG[size];
  const rotation = TREND_ROTATION[direction];
  const indicatorSize = fitToContainer
    ? 'var(--glucose-indicator-size)'
    : cfg.outer;
  const indicatorFontSize = fitToContainer
    ? 'var(--glucose-indicator-value-font-size)'
    : cfg.fontSize;
  const fitContainerStyles =
    fitToContainer && !showUnit && !showAge
      ? {
          ...FIT_CONTAINER_STYLES,
          ...FIT_CONTAINER_COMPACT_LABEL_STYLES,
        }
      : FIT_CONTAINER_STYLES;

  const renderedValue = isStale ? '--' : displayValue ?? value.toFixed(1);
  const textFill = theme === 'dark' ? 'var(--color-base-white-frost)' : color;

  useEffect(() => {
    const apply = () => {
      setTheme(
        document.documentElement.classList.contains('theme-dark')
          ? 'dark'
          : 'light',
      );
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!timestamp) return;

    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [timestamp]);

  return (
    <div
      style={
        fitToContainer
          ? {
              ...fitContainerStyles,
              placeItems: fitPlacement,
            }
          : {
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }
      }
    >
      <div
        style={{
          alignItems: 'center',
          display: 'inline-flex',
          flexDirection: 'column',
          gap: fitToContainer ? 'var(--glucose-indicator-gap)' : 10,
          maxHeight: '100%',
          maxWidth: '100%',
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: indicatorSize,
            height: indicatorSize,
            maxHeight: '100%',
            maxWidth: '100%',
          }}
        >
          <div
            style={{
              color,
              opacity: isStale ? 0.4 : 1,
              width: indicatorSize,
              height: indicatorSize,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `${CIRCLE_CENTER_X * 100}% ${CIRCLE_CENTER_Y * 100}%`,
              transition: 'transform 0.3s ease',
            }}
          >
            <Icon
              icon="glucose"
              twStyles="block w-full h-full"
              title="Glucose indicator"
            />
          </div>
          <span
            style={{
              position: 'absolute',
              top: `${CIRCLE_CENTER_Y * 100}%`,
              left: `${CIRCLE_CENTER_X * 100}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: indicatorFontSize,
              color: isStale ? 'rgb(241 245 249 / 0.6)' : textFill,
              fontWeight: 700,
              fontFamily: 'var(--font-plex-mono), monospace',
              letterSpacing: 0,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {renderedValue}
          </span>
        </div>

        {showUnit ? (
          <span
            className={twMerge(cfg.unitClassName, 'text-text-soft')}
            style={
              fitToContainer
                ? {
                    fontSize: 'var(--glucose-indicator-unit-font-size)',
                    lineHeight: 1,
                  }
                : undefined
            }
          >
            {unit}
          </span>
        ) : null}
        {showAge && timestamp && (
          <span className={twMerge(cfg.ageClassName, 'text-text-dim')}>
            {formatAge(timestamp, nowMs)}
          </span>
        )}
      </div>
    </div>
  );
};
