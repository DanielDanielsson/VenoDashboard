'use client';

import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

type FreshnessStatus = 'fresh' | 'aging' | 'stale' | 'inactive';

const STATUS_COLOR: Record<FreshnessStatus, string> = {
  fresh: 'var(--success)',
  aging: 'var(--warning)',
  stale: 'var(--error)',
  inactive: 'var(--text-soft)',
};

const getStatus = (ageMs: number): FreshnessStatus => {
  const minutes = ageMs / 60_000;
  if (minutes < 5) return 'fresh';
  if (minutes < 10) return 'aging';
  return 'stale';
};

const getAgeParts = (ageMs: number): { prefix: string; seconds: number | null } => {
  const totalSeconds = Math.floor(ageMs / 1_000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return { prefix: minutes > 0 ? `${minutes}m` : '', seconds };
  const hours = Math.floor(minutes / 60);
  return { prefix: `${hours}h ${minutes % 60}m`, seconds: null };
};

interface DataFreshnessLightProps {
  timestamp?: string | null;
  fallbackLabel?: string;
  status?: FreshnessStatus;
  autoUpdateEventName?: string | null;
  twStyles?: string;
}

export const DataFreshnessLight = ({
  timestamp,
  fallbackLabel = 'No signal yet',
  status,
  autoUpdateEventName = 'pulse-glucose-latest',
  twStyles,
}: DataFreshnessLightProps) => {
  const [nowMs, setNowMs] = useState(Date.now);
  const [readingTimestamp, setReadingTimestamp] = useState(timestamp);

  useEffect(() => {
    setReadingTimestamp(timestamp);
  }, [timestamp]);

  useEffect(() => {
    const id = globalThis.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => globalThis.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!autoUpdateEventName) {
      return;
    }

    function handleUpdate(e: Event) {
      const reading = (e as CustomEvent).detail as { timestamp: string };
      if (reading?.timestamp) {
        setReadingTimestamp(reading.timestamp);
      }
    }
    globalThis.addEventListener(autoUpdateEventName, handleUpdate);
    return () => globalThis.removeEventListener(autoUpdateEventName, handleUpdate);
  }, [autoUpdateEventName]);

  const hasTimestamp = Boolean(readingTimestamp);
  const ageMs = hasTimestamp ? nowMs - new Date(readingTimestamp as string).getTime() : null;
  const derivedStatus = status ?? (ageMs != null ? getStatus(ageMs) : 'inactive');
  const color = STATUS_COLOR[derivedStatus];
  const { prefix, seconds } = ageMs != null ? getAgeParts(ageMs) : { prefix: '', seconds: null };

  const textStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.04em',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div className={twMerge('flex items-center gap-1.5', twStyles)}>
      <span suppressHydrationWarning className="text-dashboard-panel-title flex items-center gap-1">
        {hasTimestamp ? (
          <>
            {prefix && <span style={textStyle}>{prefix}</span>}
            {seconds !== null && (
              <span suppressHydrationWarning style={{ ...textStyle, display: 'inline-block', width: '3ch', textAlign: 'right' }}>
                {String(seconds).padStart(2, '0')}s
              </span>
            )}
            <span style={textStyle}>ago</span>
          </>
        ) : (
          <span style={textStyle}>{fallbackLabel}</span>
        )}
      </span>
      <span
        style={{
          display: 'block',
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 5px 1px ${color}`,
          flexShrink: 0,
        }}
      />
    </div>
  );
};
