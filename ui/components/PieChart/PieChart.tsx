'use client';

import { animate } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import './pieChart.css';
import { PieChartLegend } from './PieChartLegend';
import type { PieChartProps, PieChartSlice } from './PieChart.types';

const DEFAULT_SIZE = 184;
const DEFAULT_OUTER_RADIUS = 78;
const DEFAULT_DONUT_INNER_RADIUS = 46;
const PIE_CHART_PALETTE = [
  'var(--color-pie-chart-palette-1)',
  'var(--color-pie-chart-palette-2)',
  'var(--color-pie-chart-palette-3)',
  'var(--color-pie-chart-palette-4)',
  'var(--color-pie-chart-palette-5)',
  'var(--color-pie-chart-palette-6)',
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function buildSlicePath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  sweepAngle: number,
): string {
  const sweep = clamp(sweepAngle, 0.001, 359.999);
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle + sweep);
  const largeArc = sweep > 180 ? 1 : 0;

  if (innerRadius <= 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
      'Z',
    ].join(' ');
  }

  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle + sweep);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

function defaultFormatValue(slice: PieChartSlice): string {
  return String(Math.round(slice.value));
}

export function PieChart({
  data,
  ariaLabel,
  size = DEFAULT_SIZE,
  variant = 'donut',
  innerRadius,
  showLegend = true,
  centerValue,
  centerLabel,
  emptyLabel = 'No data',
  animateOnChange = true,
  formatValue = defaultFormatValue,
  activeSliceId: controlledActiveSliceId = null,
  onSliceHover,
  onSliceClick,
}: PieChartProps): ReactElement {
  const targetValues = useMemo(() => data.map((slice) => Math.max(0, slice.value)), [data]);
  const [animatedValues, setAnimatedValues] = useState<number[]>(targetValues);
  const animatedValuesRef = useRef<number[]>(targetValues);
  const [uncontrolledActiveSliceId, setUncontrolledActiveSliceId] = useState<string | null>(null);

  useEffect(() => {
    if (!animateOnChange) {
      animatedValuesRef.current = targetValues;
      return;
    }

    const from = targetValues.map((_, index) => animatedValuesRef.current[index] ?? 0);
    const control = animate(0, 1, {
      duration: 0.45,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: (progress) => {
        const next = targetValues.map((value, index) => from[index] + (value - from[index]) * progress);
        animatedValuesRef.current = next;
        setAnimatedValues(next);
      },
      onComplete: () => {
        animatedValuesRef.current = targetValues;
        setAnimatedValues(targetValues);
      },
    });

    return () => control.stop();
  }, [animateOnChange, targetValues]);

  const displayedValues = animateOnChange ? animatedValues : targetValues;

  const normalizedSlices = useMemo(() => {
    return data.map((slice, index) => ({
      ...slice,
      value: displayedValues[index] ?? 0,
      color: slice.color ?? PIE_CHART_PALETTE[index % PIE_CHART_PALETTE.length],
    }));
  }, [data, displayedValues]);

  const total = normalizedSlices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const activeSliceId = controlledActiveSliceId ?? uncontrolledActiveSliceId;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = DEFAULT_OUTER_RADIUS;
  const resolvedInnerRadius = variant === 'donut' ? innerRadius ?? DEFAULT_DONUT_INNER_RADIUS : 0;
  const renderedSlices = useMemo(() => {
    return normalizedSlices.reduce<{
      items: Array<PieChartSlice & { path: string; safeValue: number }>;
      nextAngle: number;
    }>(
      (accumulator, slice) => {
        const safeValue = Math.max(0, slice.value);
        const sweepAngle = total > 0 ? (safeValue / total) * 360 : 0;
        const path = buildSlicePath(
          cx,
          cy,
          resolvedInnerRadius,
          outerRadius,
          accumulator.nextAngle,
          sweepAngle,
        );

        return {
          items: [...accumulator.items, { ...slice, path, safeValue }],
          nextAngle: accumulator.nextAngle + sweepAngle,
        };
      },
      { items: [], nextAngle: 0 },
    ).items;
  }, [cx, cy, normalizedSlices, outerRadius, resolvedInnerRadius, total]);

  function handleSliceKeyDown(event: KeyboardEvent<SVGPathElement>, slice: PieChartSlice) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onSliceClick?.(slice);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-center gap-6">
        <div className="relative">
          <svg
            role="img"
            aria-label={ariaLabel}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            {variant === 'donut' && (
              <circle
                cx={cx}
                cy={cy}
                r={(outerRadius + resolvedInnerRadius) / 2}
                className="fill-none stroke-pie-chart-track"
                strokeWidth={outerRadius - resolvedInnerRadius}
              />
            )}
            {variant === 'pie' && total <= 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={outerRadius}
                className="fill-pie-chart-empty"
              />
            ) : null}
            {renderedSlices.map((slice) => {
              const isInteractive = Boolean(onSliceClick || onSliceHover);
              const isDimmed = Boolean(activeSliceId && activeSliceId !== slice.id);

              return (
                <path
                  key={slice.id}
                  d={slice.path}
                  fill={slice.safeValue <= 0 ? 'none' : slice.color}
                  className="stroke-pie-chart-separator"
                  strokeWidth={variant === 'donut' ? 2 : 1.5}
                  style={{
                    opacity: isDimmed ? 0.5 : 1,
                    transition: 'opacity 160ms ease',
                    cursor: isInteractive ? 'pointer' : 'default',
                  }}
                  role={isInteractive ? 'button' : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  aria-label={isInteractive ? `${slice.label}: ${formatValue(slice, total)}` : undefined}
                  onMouseEnter={() => {
                    setUncontrolledActiveSliceId(slice.id);
                    onSliceHover?.(slice);
                  }}
                  onMouseLeave={() => {
                    setUncontrolledActiveSliceId(null);
                    onSliceHover?.(null);
                  }}
                  onFocus={() => {
                    setUncontrolledActiveSliceId(slice.id);
                    onSliceHover?.(slice);
                  }}
                  onBlur={() => {
                    setUncontrolledActiveSliceId(null);
                    onSliceHover?.(null);
                  }}
                  onClick={() => onSliceClick?.(slice)}
                  onKeyDown={(event) => handleSliceKeyDown(event, slice)}
                />
              );
            })}
          </svg>
          {variant === 'donut' && (centerValue || centerLabel || total <= 0) ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div className="grid gap-1">
                <span className="ui_mono_value_md text-pie-chart-center-value">
                  {centerValue ?? (total > 0 ? Math.round(total) : emptyLabel)}
                </span>
                <span className="ui_micro_label text-pie-chart-center-label">
                  {centerLabel ?? (total > 0 ? 'Total' : '')}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {showLegend ? (
          <div className="min-w-[220px] flex-1">
            <PieChartLegend
              data={normalizedSlices}
              total={total}
              activeSliceId={activeSliceId}
              formatValue={formatValue}
              onSliceHover={onSliceHover}
              onSliceClick={onSliceClick}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
