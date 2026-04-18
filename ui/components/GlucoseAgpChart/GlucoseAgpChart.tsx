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
import { SecondaryButton } from '../SecondaryButton';

interface GlucoseAgpChartProps {
  data: ChartPoint[];
  height?: number;
  yMax?: number;
}

const MIN_AGP_COVERAGE_MS = 24 * 60 * 60 * 1000;
const Y_MIN = 2;
const LOW_THRESHOLD = 4;
const HIGH_THRESHOLD = 10;
const PADDING = { top: 24, right: 28, bottom: 40, left: 84 };
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

function getCoverageDurationMs(items: ChartPoint[]): number {
  if (items.length < 2) {
    return 0;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    const timestamp = new Date(item.timestamp).getTime();
    if (timestamp < min) {
      min = timestamp;
    }
    if (timestamp > max) {
      max = timestamp;
    }
  }

  return Number.isFinite(min) && Number.isFinite(max) ? Math.max(0, max - min) : 0;
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
  const [hoveredDisabledFilter, setHoveredDisabledFilter] = useState<AgpWeekdayFilter | null>(null);
  const [hoveredBucketIndex, setHoveredBucketIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const read = () => document.documentElement.classList.contains('theme-dark');
    const handleChange = () => setIsDark(read());
    handleChange();
    window.addEventListener('pulse-theme-change', handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener('pulse-theme-change', handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

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

  const coverageByFilter = Object.fromEntries(
    AGP_WEEKDAY_OPTIONS.map((option) => {
      const items = filterAgpItemsByWeekday(data, option.key);
      return [option.key, getCoverageDurationMs(items)];
    })
  ) as Record<AgpWeekdayFilter, number>;
  const isFilterEnabled = (filter: AgpWeekdayFilter) => coverageByFilter[filter] > MIN_AGP_COVERAGE_MS;
  const isCurrentFilterEnabled = isFilterEnabled(weekdayFilter);
  const isAllFilterEnabled = isFilterEnabled('all');
  const effectiveWeekdayFilter =
    isCurrentFilterEnabled || !isAllFilterEnabled ? weekdayFilter : 'all';
  const filteredData = filterAgpItemsByWeekday(data, effectiveWeekdayFilter);
  const weekdayCounts = getAgpWeekdayCounts(data);
  const profile = computeAgpProfile(filteredData);
  const interactiveBuckets = profile.buckets.filter((bucket) => bucket.sampleCount > 0);
  const chartHeight = Math.max(0, height - PADDING.top - PADDING.bottom);
  const svgWidth = Math.max(320, Math.floor(containerWidth || 0));
  const chartWidth = Math.max(0, svgWidth - PADDING.left - PADDING.right);
  const activeSummary = formatFilterSummary(effectiveWeekdayFilter, profile.dayCount);
  const yTicks = getYAxisTicks(yMax);
  const hoveredBucket = hoveredBucketIndex === null ? null : profile.buckets[hoveredBucketIndex] ?? null;
  const isDisabled = !isFilterEnabled(effectiveWeekdayFilter);
  const disabledHintColor = isDark ? '#fda4af' : '#be123c';

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

      <div
        className="ui_caption_strong"
        style={{
          minHeight: 18,
          marginBottom: '0.4rem',
          color: disabledHintColor,
          letterSpacing: '0.02em'
        }}
      >
        {hoveredDisabledFilter ? 'timerange to short' : ''}
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
          const isActive = option.key === effectiveWeekdayFilter;
          const count = weekdayCounts[option.key];
          const isOptionDisabled = !isFilterEnabled(option.key);

          return (
            <div
              key={option.key}
              className="flex-shrink-0"
              onMouseEnter={() => setHoveredDisabledFilter(isOptionDisabled ? option.key : null)}
              onMouseLeave={() => setHoveredDisabledFilter((current) => (current === option.key ? null : current))}
            >
              <SecondaryButton
                isActive={isActive}
                onClick={() => setWeekdayFilter(option.key)}
                disabled={isOptionDisabled}
                twStyles="inline-flex min-h-[3.5rem] min-w-[4.75rem] items-center justify-center p-2"
              >
                <span className="flex items-center gap-1.5">
                  <span className="ui_caption">{option.shortLabel}</span>
                  <span className="ui_caption opacity-70">{count}d</span>
                </span>
              </SecondaryButton>
            </div>
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
          style={{
            display: 'block',
            opacity: isDisabled ? 0.28 : 1,
            filter: isDisabled ? 'grayscale(0.2)' : 'none',
            transition: 'opacity 180ms ease'
          }}
          onMouseMove={isDisabled ? undefined : handleMouseMove}
          onMouseLeave={isDisabled ? undefined : handleMouseLeave}
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
                className="ui_chart_axis_text"
                x={PADDING.left - 10}
                y={yForValue(tick)}
                fill={tick === LOW_THRESHOLD || tick === HIGH_THRESHOLD ? 'rgba(255,255,255,0.6)' : 'var(--text-soft)'}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {tick}
              </text>
            </g>
          ))}

          <text
            className="ui_chart_axis_unit"
            x="10"
            y={PADDING.top - 6}
            fill="var(--text-soft)"
            textAnchor="start"
          >
            mmol/L
          </text>

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
                className="ui_chart_axis_text"
                x={xForMinute(tick)}
                y={height - 14}
                fill="var(--text-soft)"
                textAnchor="middle"
              >
                {formatHourLabel(tick)}
              </text>
            </g>
          ))}

          {band10To90.map((path) => (
            <path key={path} d={path} fill={isDark ? 'rgba(34, 211, 238, 0.14)' : 'rgba(5, 130, 160, 0.18)'} stroke="none" />
          ))}
          {band25To75.map((path) => (
            <path key={path} d={path} fill={isDark ? 'rgba(34, 211, 238, 0.26)' : 'rgba(5, 130, 160, 0.32)'} stroke="none" />
          ))}
          {p05Paths.map((path) => (
            <path
              key={path}
              d={path}
              fill="none"
              stroke={isDark ? 'rgba(103, 232, 249, 0.55)' : 'rgba(5, 130, 160, 0.6)'}
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
              stroke={isDark ? 'rgba(103, 232, 249, 0.55)' : 'rgba(5, 130, 160, 0.6)'}
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
              stroke={isDark ? '#f8fafc' : '#0c1222'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {!isDisabled && hoveredBucket && (
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

        {isDisabled && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              textAlign: 'center',
              pointerEvents: 'none'
            }}
          >
            <div
              className="rounded border border-border-strong bg-surface-strong text-text-dim"
              style={{
                maxWidth: 320,
                padding: '0.9rem 1rem',
                borderRadius: 'var(--radius)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <span className="ui_helper_text">
                A wider time range needs to be selected in order for the AGP profile to work.
              </span>
            </div>
          </div>
        )}

        {!isDisabled && hoveredBucket && (
          <div
            className="rounded border border-border-strong bg-surface-strong"
            style={{
              position: 'absolute',
              left: Math.min(hoverPos.x + 14, Math.max(12, containerWidth - 210)),
              top: Math.max(8, hoverPos.y - 78),
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              pointerEvents: 'none',
              backdropFilter: 'blur(12px)',
              zIndex: 10,
              minWidth: 184
            }}
          >
            <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
              {formatHourLabel(hoveredBucket.minuteOfDay)}
            </p>
            <p className="ui_mono_value_md text-text" style={{ margin: '6px 0 0' }}>
              Median {hoveredBucket.p50?.toFixed(1) ?? '—'}
            </p>
            <p className="ui_caption text-text-dim" style={{ margin: '6px 0 0' }}>
              50% band {hoveredBucket.p25?.toFixed(1) ?? '—'} to {hoveredBucket.p75?.toFixed(1) ?? '—'}
            </p>
            <p className="ui_caption text-text-dim" style={{ margin: '2px 0 0' }}>
              80% band {hoveredBucket.p10?.toFixed(1) ?? '—'} to {hoveredBucket.p90?.toFixed(1) ?? '—'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
