'use client';

import { useEffect, useState } from 'react';

type FreshnessStatus = 'fresh' | 'aging' | 'stale';

const STATUS_COLOR: Record<FreshnessStatus, string> = {
  fresh: 'var(--success)',
  aging: 'var(--warning)',
  stale: 'var(--error)',
};

function getStatus(ageMs: number): FreshnessStatus {
  const minutes = ageMs / 60_000;
  if (minutes < 5) return 'fresh';
  if (minutes < 10) return 'aging';
  return 'stale';
}

function getAgeParts(ageMs: number): { prefix: string; seconds: number | null } {
  const totalSeconds = Math.floor(ageMs / 1_000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return { prefix: minutes > 0 ? `${minutes}m` : '', seconds };
  const hours = Math.floor(minutes / 60);
  return { prefix: `${hours}h ${minutes % 60}m`, seconds: null };
}

interface DataFreshnessLightProps {
  timestamp: string;
}

export function DataFreshnessLight({ timestamp }: DataFreshnessLightProps) {
  const [nowMs, setNowMs] = useState(Date.now);
  const [readingTimestamp, setReadingTimestamp] = useState(timestamp);

  useEffect(() => {
    const id = globalThis.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => globalThis.clearInterval(id);
  }, []);

  useEffect(() => {
    function handleUpdate(e: Event) {
      const reading = (e as CustomEvent).detail as { timestamp: string };
      if (reading?.timestamp) {
        setReadingTimestamp(reading.timestamp);
      }
    }
    globalThis.addEventListener('pulse-glucose-latest', handleUpdate);
    return () => globalThis.removeEventListener('pulse-glucose-latest', handleUpdate);
  }, []);

  const ageMs = nowMs - new Date(readingTimestamp).getTime();
  const status = getStatus(ageMs);
  const color = STATUS_COLOR[status];
  const { prefix, seconds } = getAgeParts(ageMs);

  const textStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.04em',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span suppressHydrationWarning className="text-dashboard-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.25em' }}>
        {prefix && <span style={textStyle}>{prefix}</span>}
        {seconds !== null && (
          <span suppressHydrationWarning style={{ ...textStyle, display: 'inline-block', width: '3ch', textAlign: 'right' }}>
            {String(seconds).padStart(2, '0')}s
          </span>
        )}
        <span style={textStyle}>ago</span>
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
}
