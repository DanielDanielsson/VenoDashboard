'use client';

import { useState, useEffect, useRef } from 'react';
import { animate } from 'framer-motion';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { computeGlucoseStats } from '@/lib/glucose/metrics';
import type { GlucoseStats } from '@/lib/glucose/metrics';
import type { GlucoseApiResponse } from '@/lib/glucose/types';

const SEGMENTS = [
  { key: 'veryLow' as const, label: 'Very Low', color: '#ef4444' },
  { key: 'low' as const, label: 'Low', color: '#fb7185' },
  { key: 'inRange' as const, label: 'In Range', color: '#11b981' },
  { key: 'high' as const, label: 'High', color: '#fbbf24' },
  { key: 'veryHigh' as const, label: 'Very High', color: '#a855f7' },
] as const;

const TIME_RANGES = [
  { label: '3d', hours: 72 },
  { label: '24d', hours: 576 },
  { label: '30d', hours: 720 },
] as const;

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 68;

function slicePath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const sweep = Math.max(0.001, Math.min(359.999, sweepDeg));
  const startRad = (startDeg - 90) * (Math.PI / 180);
  const endRad = (startDeg + sweep - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}

function statsToPercs(stats: GlucoseStats | null): number[] {
  if (!stats) return [0, 0, 100, 0, 0];
  return [
    stats.veryLow.percentage,
    stats.low.percentage,
    stats.inRange.percentage,
    stats.high.percentage,
    stats.veryHigh.percentage,
  ];
}

async function fetchHistory(hours: number): Promise<GlucoseApiResponse> {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  const url = `/api/dashboard/glucose/history?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<GlucoseApiResponse>;
}

export function TimeInRangePanel() {
  const [selectedRange, setSelectedRange] = useState(0);
  const [loadedRange, setLoadedRange] = useState<number | null>(null);
  const [stats, setStats] = useState<GlucoseStats | null>(null);
  const [displayPercs, setDisplayPercs] = useState<number[]>([0, 0, 100, 0, 0]);
  const animatedPercs = useRef<number[]>([0, 0, 100, 0, 0]);

  const loading = loadedRange !== selectedRange;

  useEffect(() => {
    let cancelled = false;
    fetchHistory(TIME_RANGES[selectedRange].hours)
      .then((data) => {
        if (cancelled) return;
        setStats(computeGlucoseStats(data.items));
        setLoadedRange(selectedRange);
      })
      .catch(() => {
        if (!cancelled) setLoadedRange(selectedRange);
      });
    return () => { cancelled = true; };
  }, [selectedRange]);

  useEffect(() => {
    const target = statsToPercs(stats);
    const start = [...animatedPercs.current];
    const ctrl = animate(0, 1, {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: (t) => {
        const next = start.map((s, i) => s + (target[i] - s) * t);
        animatedPercs.current = next;
        setDisplayPercs(next);
      },
      onComplete: () => {
        animatedPercs.current = target;
        setDisplayPercs(target);
      },
    });
    return () => ctrl.stop();
  }, [stats]);

  const total = displayPercs.reduce((a, b) => a + b, 0) || 100;
  const paths = displayPercs.map((p, i) => {
    const startDeg = displayPercs.slice(0, i).reduce((s, v) => s + (v / total) * 360, 0);
    const sweep = (p / total) * 360;
    return slicePath(CX, CY, R, startDeg, sweep);
  });

  return (
    <DashboardPanel
      title="Time In Range"
      headerRight={
        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setSelectedRange(i)}
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid',
                borderColor: selectedRange === i ? 'var(--text)' : 'rgba(148,163,184,0.3)',
                background: selectedRange === i ? 'var(--text)' : 'transparent',
                color: selectedRange === i ? 'var(--bg)' : 'var(--text-soft)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.05em',
                lineHeight: 1.6,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ opacity: loading ? 0.35 : 1, transition: 'opacity 0.2s ease' }}
        >
          {SEGMENTS.map((seg, i) => (
            <path
              key={seg.key}
              d={paths[i]}
              fill={displayPercs[i] < 0.5 ? 'none' : seg.color}
              style={{ stroke: 'var(--color-dashboard-panel-bg)', strokeWidth: 1.5 }}
            />
          ))}
        </svg>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {SEGMENTS.map((seg, i) => (
            <div key={seg.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-soft)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {seg.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text)',
                  fontFamily: 'var(--font-plex-mono), monospace',
                  lineHeight: 1,
                }}
              >
                {Math.round(displayPercs[i])}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}
