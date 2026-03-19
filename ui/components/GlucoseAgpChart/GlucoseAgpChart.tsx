'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AGP_WEEKDAY_OPTIONS,
  computeAgpProfile,
  filterAgpItemsByWeekday,
  getAgpWeekdayCounts,
  type AgpWeekdayFilter
} from '@/lib/glucose/agp';
import type { ChartPoint } from '@/lib/glucose/types';

interface GlucoseAgpChartProps {
  data: ChartPoint[];
  height?: number;
  yMax?: number;
}

const Y_MIN = 2;
const LOW_THRESHOLD = 4;
const HIGH_THRESHOLD = 10;
const PADDING = { top: 24, right: 28, bottom: 40, left: 52 };
const X_TICKS = [0, 6 * 60, 12 * 60, 18 * 60, 24 * 60];

interface PlotPoint {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function formatHourLabel(minuteOfDay: number): string {
  if (minuteOfDay >= 24 * 60) {
    return '24:00';
  }

  const hours = Math.floor(minuteOfDay / 60);
  return `${hours.toString().padStart(2, '0')}:00`;
}

function formatFilterSummary(filter: AgpWeekdayFilter, dayCount: number): string {
  if (filter === 'all') {
    return `${dayCount} day${dayCount === 1 ? '' : 's'} in view`;
  }

  const option = AGP_WEEKDAY_OPTIONS.find((entry) => entry.key === filter);
  if (!option) {
    return `${dayCount} day${dayCount === 1 ? '' : 's'} in view`;
  }

  const baseLabel = dayCount === 1 ? option.label.slice(0, -1) : option.label;
  return `${dayCount} ${baseLabel.toLowerCase()} in view`;
}

function getYAxisTicks(yMax: number): number[] {
  const range = yMax - Y_MIN;
  const roughStep = range / 8;

  if (roughStep <= 1) {
    const ticks: number[] = [];
    for (let value = Y_MIN; value <= yMax; value += 1) {
      ticks.push(value);
    }
    return ticks;
  }

  if (roughStep <= 2) {
    const ticks: number[] = [];
    for (let value = Y_MIN; value <= yMax; value += 2) {
      ticks.push(value);
    }
    return ticks;
  }

  const ticks: number[] = [Y_MIN];
  for (let value = 4; value <= yMax; value += 4) {
    ticks.push(value);
  }

  if (ticks[ticks.length - 1] !== yMax) {
    ticks.push(yMax);
  }

  return ticks;
}

function buildLineSegments(points: Array<PlotPoint | null>): string[] {
  const paths: string[] = [];
  let current: PlotPoint[] = [];

  for (const point of points) {
    if (!point) {
      if (current.length >= 2) {
        paths.push(current.map((item, index) => `${index === 0 ? 'M' : 'L'} ${item.x} ${item.y}`).join(' '));
      }
      current = [];
      continue;
    }

    current.push(point);
  }

  if (current.length >= 2) {
    paths.push(current.map((item, index) => `${index === 0 ? 'M' : 'L'} ${item.x} ${item.y}`).join(' '));
  }

  return paths;
}

function buildBandSegments(
  upper: Array<PlotPoint | null>,
  lower: Array<PlotPoint | null>
): string[] {
  const paths: string[] = [];
  let upperSegment: PlotPoint[] = [];
  let lowerSegment: PlotPoint[] = [];

  for (let index = 0; index < upper.length; index += 1) {
    const upperPoint = upper[index];
    const lowerPoint = lower[index];

    if (!upperPoint || !lowerPoint) {
      if (upperSegment.length >= 2 && lowerSegment.length >= 2) {
        const upperPath = upperSegment.map((point, segmentIndex) => `${segmentIndex === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
        const lowerPath = [...lowerSegment]
          .reverse()
          .map((point) => `L ${point.x} ${point.y}`)
          .join(' ');
        paths.push(`${upperPath} ${lowerPath} Z`);
      }

      upperSegment = [];
      lowerSegment = [];
      continue;
    }

    upperSegment.push(upperPoint);
    lowerSegment.push(lowerPoint);
  }

  if (upperSegment.length >= 2 && lowerSegment.length >= 2) {
    const upperPath = upperSegment.map((point, segmentIndex) => `${segmentIndex === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const lowerPath = [...lowerSegment]
      .reverse()
      .map((point) => `L ${point.x} ${point.y}`)
      .join(' ');
    paths.push(`${upperPath} ${lowerPath} Z`);
  }

  return paths;
}

export function GlucoseAgpChart({ data, height = 320, yMax = 25 }: GlucoseAgpChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [weekdayFilter, setWeekdayFilter] = useState<AgpWeekdayFilter>('all');
  const [hoveredBucketIndex, setHoveredBucketIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    setContainerWidth(container.clientWidth);

    return () => observer.disconnect();
  }, []);

  const filteredData = filterAgpItemsByWeekday(data, weekdayFilter);
  const weekdayCounts = getAgpWeekdayCounts(data);
  const profile = computeAgpProfile(filteredData);
  const interactiveBuckets = profile.buckets.filter((bucket) => bucket.sampleCount > 0);
  const chartHeight = Math.max(0, height - PADDING.top - PADDING.bottom);
  const svgWidth = Math.max(320, Math.floor(containerWidth || 0));
  const chartWidth = Math.max(0, svgWidth - PADDING.left - PADDING.right);
  const activeSummary = formatFilterSummary(weekdayFilter, profile.dayCount);
  const yTicks = getYAxisTicks(yMax);
  const hoveredBucket = hoveredBucketIndex === null ? null : profile.buckets[hoveredBucketIndex] ?? null;

  function xForMinute(minuteOfDay: number): number {
    return PADDING.left + (minuteOfDay / (24 * 60)) * chartWidth;
  }

  function yForValue(value: number): number {
    const clamped = clamp(value, Y_MIN, yMax);
    return PADDING.top + chartHeight * (1 - (clamped - Y_MIN) / (yMax - Y_MIN));
  }

  function handleMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (
      mouseX < PADDING.left ||
      mouseX > PADDING.left + chartWidth ||
      mouseY < PADDING.top ||
      mouseY > PADDING.top + chartHeight
    ) {
      setHoveredBucketIndex(null);
      return;
    }

    const targetMinute = ((mouseX - PADDING.left) / chartWidth) * 24 * 60;
    let nearestBucket = interactiveBuckets[0] ?? null;
    let nearestDistance = nearestBucket ? Math.abs(nearestBucket.minuteOfDay - targetMinute) : Infinity;

    for (const bucket of interactiveBuckets) {
      const distance = Math.abs(bucket.minuteOfDay - targetMinute);
      if (distance < nearestDistance) {
        nearestBucket = bucket;
        nearestDistance = distance;
      }
    }

    if (!nearestBucket) {
      setHoveredBucketIndex(null);
      return;
    }

    setHoveredBucketIndex(nearestBucket.bucketIndex);
    setHoverPos({ x: mouseX, y: mouseY });
  }

  function handleMouseLeave() {
    setHoveredBucketIndex(null);
  }

  const p05Points = profile.buckets.map((bucket) =>
    bucket.p05 === null ? null : { x: xForMinute(bucket.minuteOfDay), y: yForValue(bucket.p05) }
  );
  const p10Points = profile.buckets.map((bucket) =>
    bucket.p10 === null ? null : { x: xForMinute(bucket.minuteOfDay), y: yForValue(bucket.p10) }
  );
  const p25Points = profile.buckets.map((bucket) =>
    bucket.p25 === null ? null : { x: xForMinute(bucket.minuteOfDay), y: yForValue(bucket.p25) }
  );
  const p50Points = profile.buckets.map((bucket) =>
    bucket.p50 === null ? null : { x: xForMinute(bucket.minuteOfDay), y: yForValue(bucket.p50) }
  );
  const p75Points = profile.buckets.map((bucket) =>
    bucket.p75 === null ? null : { x: xForMinute(bucket.minuteOfDay), y: yForValue(bucket.p75) }
  );
  const p90Points = profile.buckets.map((bucket) =>
    bucket.p90 === null ? null : { x: xForMinute(bucket.minuteOfDay), y: yForValue(bucket.p90) }
  );
  const p95Points = profile.buckets.map((bucket) =>
    bucket.p95 === null ? null : { x: xForMinute(bucket.minuteOfDay), y: yForValue(bucket.p95) }
  );

  const band10To90 = buildBandSegments(p10Points, p90Points);
  const band25To75 = buildBandSegments(p25Points, p75Points);
  const medianPaths = buildLineSegments(p50Points);
  const p05Paths = buildLineSegments(p05Points);
  const p95Paths = buildLineSegments(p95Points);

  return (
    <div ref={containerRef} style={{ padding: '1rem 1.25rem 1.25rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
        flexWrap: 'wrap'
      }}>
        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em'
          }}>
            AGP
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px 14px',
          flexWrap: 'wrap',
          fontSize: 11,
          color: 'var(--text-soft)',
          minWidth: 0
        }}>
          <span style={{ whiteSpace: 'nowrap' }}>{activeSummary}</span>
          <span style={{ whiteSpace: 'nowrap', opacity: 0.7 }}>Median · 50% · 80% band · 5%/95%</span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '0.35rem',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        marginBottom: '1rem',
        paddingBottom: 2
      }}>
        {AGP_WEEKDAY_OPTIONS.map((option) => {
          const isActive = option.key === weekdayFilter;
          const count = weekdayCounts[option.key];

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setWeekdayFilter(option.key)}
              className={isActive ? 'button-primary' : 'button-ghost'}
              style={{
                minHeight: '2.2rem',
                padding: '0.25rem 0.625rem',
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                gap: 1,
                flexShrink: 0,
                minWidth: '3.75rem'
              }}
            >
              <span style={{ fontSize: '0.775rem', lineHeight: 1 }}>{option.shortLabel}</span>
              <span style={{ fontSize: '0.65rem', lineHeight: 1, opacity: 0.7 }}>
                {count}d
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label="Ambulatory glucose profile chart"
          style={{ display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <rect x="0" y="0" width={svgWidth} height={height} fill="transparent" />
          {X_TICKS.slice(0, -1).map((tick, index) => (
            <rect
              key={`band-${tick}`}
              x={xForMinute(tick)}
              y={PADDING.top}
              width={chartWidth / 4}
              height={chartHeight}
              fill={index % 2 === 0 ? 'rgba(148, 163, 184, 0.025)' : 'rgba(15, 23, 42, 0.02)'}
            />
          ))}
          <rect
            x={PADDING.left}
            y={yForValue(HIGH_THRESHOLD)}
            width={chartWidth}
            height={yForValue(LOW_THRESHOLD) - yForValue(HIGH_THRESHOLD)}
            fill="rgba(52, 211, 153, 0.06)"
          />

          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left}
                y1={yForValue(tick)}
                x2={svgWidth - PADDING.right}
                y2={yForValue(tick)}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 10}
                y={yForValue(tick)}
                fill={tick === LOW_THRESHOLD || tick === HIGH_THRESHOLD ? 'rgba(255,255,255,0.6)' : 'var(--text-soft)'}
                fontSize="11"
                textAnchor="end"
                dominantBaseline="middle"
                style={{ fontFamily: 'var(--font-plex-mono), monospace' }}
              >
                {tick}
              </text>
            </g>
          ))}

          <line
            x1={PADDING.left}
            y1={yForValue(LOW_THRESHOLD)}
            x2={svgWidth - PADDING.right}
            y2={yForValue(LOW_THRESHOLD)}
            stroke="rgba(251, 113, 133, 0.45)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1={PADDING.left}
            y1={yForValue(HIGH_THRESHOLD)}
            x2={svgWidth - PADDING.right}
            y2={yForValue(HIGH_THRESHOLD)}
            stroke="rgba(251, 191, 36, 0.45)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {X_TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={xForMinute(tick)}
                y1={PADDING.top}
                x2={xForMinute(tick)}
                y2={PADDING.top + chartHeight}
                stroke="rgba(148, 163, 184, 0.28)"
                strokeWidth="1.5"
              />
              <text
                x={xForMinute(tick)}
                y={height - 14}
                fill="var(--text-soft)"
                fontSize="11"
                textAnchor="middle"
                style={{ fontFamily: 'var(--font-plex-mono), monospace' }}
              >
                {formatHourLabel(tick)}
              </text>
            </g>
          ))}

          {band10To90.map((path) => (
            <path key={path} d={path} fill="rgba(34, 211, 238, 0.14)" stroke="none" />
          ))}
          {band25To75.map((path) => (
            <path key={path} d={path} fill="rgba(34, 211, 238, 0.26)" stroke="none" />
          ))}
          {p05Paths.map((path) => (
            <path
              key={path}
              d={path}
              fill="none"
              stroke="rgba(103, 232, 249, 0.55)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {p95Paths.map((path) => (
            <path
              key={path}
              d={path}
              fill="none"
              stroke="rgba(103, 232, 249, 0.55)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {medianPaths.map((path) => (
            <path
              key={path}
              d={path}
              fill="none"
              stroke="#f8fafc"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {hoveredBucket && (
            <line
              x1={xForMinute(hoveredBucket.minuteOfDay)}
              y1={PADDING.top}
              x2={xForMinute(hoveredBucket.minuteOfDay)}
              y2={PADDING.top + chartHeight}
              stroke="rgba(148, 163, 184, 0.65)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />
          )}
        </svg>

        {hoveredBucket && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(hoverPos.x + 14, Math.max(12, containerWidth - 210)),
              top: Math.max(8, hoverPos.y - 78),
              background: 'var(--surface-strong)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              pointerEvents: 'none',
              backdropFilter: 'blur(12px)',
              zIndex: 10,
              minWidth: 184
            }}
          >
            <p style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--text-soft)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em'
            }}>
              {formatHourLabel(hoveredBucket.minuteOfDay)}
            </p>
            <p style={{
              margin: '6px 0 0',
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'var(--font-plex-mono), monospace',
              color: 'var(--text)'
            }}>
              Median {hoveredBucket.p50?.toFixed(1) ?? '—'}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>
              50% band {hoveredBucket.p25?.toFixed(1) ?? '—'} to {hoveredBucket.p75?.toFixed(1) ?? '—'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>
              80% band {hoveredBucket.p10?.toFixed(1) ?? '—'} to {hoveredBucket.p90?.toFixed(1) ?? '—'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
