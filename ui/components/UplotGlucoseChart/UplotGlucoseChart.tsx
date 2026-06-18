'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { ChartPoint } from '@/lib/glucose/types';
import { getGlucoseColor, type GlucoseColorMode } from '@/lib/glucose/tints';
import { convertGlucoseValue, type GlucoseUnit } from '@/lib/glucose/units';

export type UplotGlucoseChartRenderMode = 'auto' | 'line' | 'points';

export interface UplotGlucoseChartProps {
  ariaLabel?: string;
  data: ChartPoint[];
  timeWindow: {
    from: string;
    to: string;
  };
  height: number;
  yMax: number;
  colorMode: GlucoseColorMode;
  glucoseUnit?: GlucoseUnit;
  editable?: boolean;
  renderMode?: UplotGlucoseChartRenderMode;
  selectedReadingIds?: string[];
  onPointSelect?: (point: ChartPoint) => void;
  onZoomWindowChange?: (window: { from: string; to: string } | null) => void;
}

const LOW_THRESHOLD = 4.0;
const HIGH_THRESHOLD = 10.0;
const Y_MIN = 2.0;
const POINT_RADIUS = 2.5;
const SELECTED_POINT_RADIUS = 5;
const MIN_ZOOM_SELECT_PX = 8;
const MIN_ZOOM_RANGE_MS = 5 * 60 * 1000;
const CLICK_DRAG_TOLERANCE_PX = 3;
const AUTO_LINE_MIN_POINT_SPACING_PX = 5;
const IN_RANGE_FILL = 'rgba(52, 211, 153, 0.06)';
const HIDDEN_SERIES_STROKE = 'rgba(0, 0, 0, 0)';
const LINE_COLOR_THRESHOLDS = [LOW_THRESHOLD, HIGH_THRESHOLD] as const;

export interface UplotGlucoseLinePoint {
  x: number;
  y: number;
  valueMmolL: number;
}

export interface UplotGlucoseLineSegment {
  from: UplotGlucoseLinePoint;
  to: UplotGlucoseLinePoint;
  valueMmolL: number;
}

const toDisplayGlucoseValue = (valueMmolL: number, glucoseUnit: GlucoseUnit): number => {
  return convertGlucoseValue(valueMmolL, 'mmol/L', glucoseUnit);
};

export const getUplotGlucoseInRangeBounds = (glucoseUnit: GlucoseUnit): {
  low: number;
  high: number;
} => {
  return {
    low: toDisplayGlucoseValue(LOW_THRESHOLD, glucoseUnit),
    high: toDisplayGlucoseValue(HIGH_THRESHOLD, glucoseUnit),
  };
};

export const resolveUplotGlucoseChartRenderMode = ({
  dataLength,
  renderMode,
  width,
}: {
  dataLength: number;
  renderMode: UplotGlucoseChartRenderMode;
  width: number;
}): Exclude<UplotGlucoseChartRenderMode, 'auto'> => {
  if (renderMode !== 'auto') {
    return renderMode;
  }

  if (dataLength > Math.max(1, Math.floor(width / AUTO_LINE_MIN_POINT_SPACING_PX))) {
    return 'line';
  }

  return 'points';
};

const interpolateLinePoint = (
  from: UplotGlucoseLinePoint,
  to: UplotGlucoseLinePoint,
  t: number,
): UplotGlucoseLinePoint => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
  valueMmolL: from.valueMmolL + (to.valueMmolL - from.valueMmolL) * t,
});

export const getUplotGlucoseLineSegments = (
  points: UplotGlucoseLinePoint[],
): UplotGlucoseLineSegment[] => {
  const segments: UplotGlucoseLineSegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];

    if (
      !Number.isFinite(from.x)
      || !Number.isFinite(from.y)
      || !Number.isFinite(from.valueMmolL)
      || !Number.isFinite(to.x)
      || !Number.isFinite(to.y)
      || !Number.isFinite(to.valueMmolL)
    ) {
      continue;
    }

    const valueDelta = to.valueMmolL - from.valueMmolL;
    const crossings = valueDelta === 0
      ? []
      : LINE_COLOR_THRESHOLDS
        .filter((threshold) => (
          (from.valueMmolL < threshold && to.valueMmolL > threshold)
          || (from.valueMmolL > threshold && to.valueMmolL < threshold)
        ))
        .map((threshold) => (threshold - from.valueMmolL) / valueDelta)
        .filter((t) => t > 0 && t < 1)
        .sort((a, b) => a - b);

    const breakpoints = [0, ...crossings, 1];

    for (let breakpointIndex = 0; breakpointIndex < breakpoints.length - 1; breakpointIndex += 1) {
      const fromT = breakpoints[breakpointIndex];
      const toT = breakpoints[breakpointIndex + 1];
      const midpointT = fromT + (toT - fromT) / 2;

      segments.push({
        from: interpolateLinePoint(from, to, fromT),
        to: interpolateLinePoint(from, to, toT),
        valueMmolL: interpolateLinePoint(from, to, midpointT).valueMmolL,
      });
    }
  }

  return segments;
};

function isDarkTheme(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }

  return !document.documentElement.classList.contains('theme-light');
}

function drawThresholdLines(u: uPlot, glucoseUnit: GlucoseUnit, isDark: boolean): void {
  const ctx = u.ctx;
  const left = u.bbox.left;
  const right = u.bbox.left + u.bbox.width;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;

  for (const threshold of [LOW_THRESHOLD, HIGH_THRESHOLD]) {
    const y = u.valToPos(toDisplayGlucoseValue(threshold, glucoseUnit), 'y', true);
    ctx.strokeStyle = getGlucoseColor(threshold === LOW_THRESHOLD ? Y_MIN : threshold + 1, 'standard', 0.45, isDark);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawInRangeArea(u: uPlot, glucoseUnit: GlucoseUnit): void {
  const { low, high } = getUplotGlucoseInRangeBounds(glucoseUnit);
  const yLow = u.valToPos(low, 'y', true);
  const yHigh = u.valToPos(high, 'y', true);
  const top = Math.min(yHigh, yLow);
  const height = Math.abs(yLow - yHigh);

  if (height <= 0) {
    return;
  }

  u.ctx.save();
  u.ctx.fillStyle = IN_RANGE_FILL;
  u.ctx.fillRect(u.bbox.left, top, u.bbox.width, height);
  u.ctx.restore();
}

function drawGlucoseLineSegments(
  u: uPlot,
  segments: UplotGlucoseLineSegment[],
  colorMode: GlucoseColorMode,
  width: number,
  isDark: boolean
): void {
  const ctx = u.ctx;
  const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width * pixelRatio;

  for (const segment of segments) {
    const fromX = u.valToPos(segment.from.x, 'x', true);
    const fromY = u.valToPos(segment.from.y, 'y', true);
    const toX = u.valToPos(segment.to.x, 'x', true);
    const toY = u.valToPos(segment.to.y, 'y', true);

    if (
      !Number.isFinite(fromX)
      || !Number.isFinite(fromY)
      || !Number.isFinite(toX)
      || !Number.isFinite(toY)
    ) {
      continue;
    }

    ctx.strokeStyle = getGlucoseColor(segment.valueMmolL, colorMode, 1, isDark);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawReadingPoints(
  u: uPlot,
  points: ChartPoint[],
  colorMode: GlucoseColorMode,
  selectedReadingIds: ReadonlySet<string>,
  mode: 'all' | 'markers',
  isDark: boolean
): void {
  const ctx = u.ctx;
  const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const xs = u.data[0];
  const ys = u.data[1];

  ctx.save();

  for (let index = 0; index < xs.length; index += 1) {
    const yValue = ys[index];
    if (yValue == null) {
      continue;
    }

    const x = u.valToPos(xs[index], 'x', true);
    const y = u.valToPos(yValue, 'y', true);
    const point = points[index];
    const isSelected = Boolean(point?.readingId && selectedReadingIds.has(point.readingId));
    const isCorrected = Boolean(point?.isCorrected);

    if (mode === 'markers' && !isSelected && !isCorrected) {
      continue;
    }

    const color = getGlucoseColor(point?.valueMmolL ?? yValue, colorMode, 1, isDark);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, POINT_RADIUS * pixelRatio, 0, Math.PI * 2);
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * pixelRatio;
      ctx.beginPath();
      ctx.arc(x, y, SELECTED_POINT_RADIUS * pixelRatio, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (isCorrected) {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)';
      ctx.lineWidth = pixelRatio;
      ctx.beginPath();
      ctx.arc(x, y, (POINT_RADIUS + 1.5) * pixelRatio, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export const getLocalMidnightSplits = (minSec: number, maxSec: number): number[] => {
  if (!Number.isFinite(minSec) || !Number.isFinite(maxSec) || maxSec <= minSec) {
    return [];
  }

  const splits: number[] = [];
  const cursor = new Date(minSec * 1000);
  cursor.setHours(0, 0, 0, 0);

  if (cursor.getTime() / 1000 < minSec) {
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cursor.getTime() / 1000 <= maxSec) {
    splits.push(cursor.getTime() / 1000);
    cursor.setDate(cursor.getDate() + 1);
  }

  return splits;
};

export const formatUplotGlucoseAxisValue = (
  value: number,
  _glucoseUnit: GlucoseUnit,
): string => {
  void _glucoseUnit;
  return String(Math.round(value));
};

export const UplotGlucoseChart = ({
  ariaLabel = 'Glucose readings chart',
  data,
  timeWindow,
  height,
  yMax,
  colorMode,
  glucoseUnit = 'mmol/L',
  editable = false,
  renderMode = 'auto',
  selectedReadingIds = [],
  onPointSelect,
  onZoomWindowChange,
}: UplotGlucoseChartProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<uPlot | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const dataRef = useRef(data);
  const onPointSelectRef = useRef(onPointSelect);
  const onZoomWindowChangeRef = useRef(onZoomWindowChange);

  useEffect(() => {
    dataRef.current = data;
    onPointSelectRef.current = onPointSelect;
    onZoomWindowChangeRef.current = onZoomWindowChange;
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const updateDimensions = () => {
      const nextWidth = Math.floor(element.clientWidth);
      const nextHeight = Math.floor(element.clientHeight);
      if (nextWidth > 0 && nextHeight > 0) {
        setDimensions((current) => (
          current.width === nextWidth && current.height === nextHeight
            ? current
            : { width: nextWidth, height: nextHeight }
        ));
      }
    };

    updateDimensions();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || dimensions.width <= 0 || dimensions.height <= 0) {
      return undefined;
    }

    const isDark = isDarkTheme();
    const fromSec = new Date(timeWindow.from).getTime() / 1000;
    const toSec = new Date(timeWindow.to).getTime() / 1000;
    const xs = data.map((point) => new Date(point.timestamp).getTime() / 1000);
    const ys = data.map((point) => toDisplayGlucoseValue(point.valueMmolL, glucoseUnit));
    const lineSegments = getUplotGlucoseLineSegments(data.map((point, index) => ({
      x: xs[index],
      y: ys[index],
      valueMmolL: point.valueMmolL,
    })));
    const selectedIds: ReadonlySet<string> = new Set(selectedReadingIds);
    const axisStroke = isDark ? 'rgba(148, 163, 184, 0.9)' : 'rgba(71, 85, 105, 0.9)';
    const gridStroke = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(71, 85, 105, 0.12)';
    const effectiveRenderMode = resolveUplotGlucoseChartRenderMode({
      dataLength: data.length,
      renderMode,
      width: dimensions.width,
    });

    const options: uPlot.Options = {
      width: dimensions.width,
      height: dimensions.height,
      legend: { show: false },
      cursor: {
        y: false,
        drag: {
          x: true,
          y: false,
          setScale: false,
          dist: MIN_ZOOM_SELECT_PX,
        },
        points: { show: false },
      },
      select: {
        show: true,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      },
      scales: {
        x: {
          time: true,
          range: [fromSec, toSec],
        },
        y: {
          range: [
            toDisplayGlucoseValue(Y_MIN, glucoseUnit),
            toDisplayGlucoseValue(yMax, glucoseUnit),
          ],
        },
      },
      axes: [
        {
          stroke: axisStroke,
          grid: { stroke: gridStroke },
          ticks: { stroke: gridStroke },
          splits: (_u, _axisIdx, scaleMin, scaleMax) => getLocalMidnightSplits(scaleMin, scaleMax),
          values: (_u, values) => values.map((value) => new Date(value * 1000).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          })),
        },
        {
          stroke: axisStroke,
          grid: { stroke: gridStroke },
          ticks: { stroke: gridStroke },
          values: (_u, values) => values.map((value) => formatUplotGlucoseAxisValue(value, glucoseUnit)),
        },
      ],
      series: [
        {},
        {
          stroke: HIDDEN_SERIES_STROKE,
          width: effectiveRenderMode === 'line' ? 1.75 : 1.25,
          points: { show: false },
          spanGaps: false,
        },
      ],
      hooks: {
        draw: [
          (u) => {
            drawInRangeArea(u, glucoseUnit);
            drawGlucoseLineSegments(
              u,
              lineSegments,
              colorMode,
              effectiveRenderMode === 'line' ? 1.75 : 1.25,
              isDark,
            );
            drawThresholdLines(u, glucoseUnit, isDark);
            drawReadingPoints(
              u,
              dataRef.current,
              colorMode,
              selectedIds,
              effectiveRenderMode === 'points' ? 'all' : 'markers',
              isDark,
            );
          },
        ],
        setSelect: [
          (u) => {
            if (u.select.width < MIN_ZOOM_SELECT_PX) {
              return;
            }

            const fromMs = u.posToVal(u.select.left, 'x') * 1000;
            const toMs = u.posToVal(u.select.left + u.select.width, 'x') * 1000;
            u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);

            if (toMs - fromMs < MIN_ZOOM_RANGE_MS) {
              return;
            }

            onZoomWindowChangeRef.current?.({
              from: new Date(fromMs).toISOString(),
              to: new Date(toMs).toISOString(),
            });
          },
        ],
        ready: [
          (u) => {
            let downX: number | null = null;

            u.over.addEventListener('mousedown', (event) => {
              downX = event.clientX;
            });

            u.over.addEventListener('click', (event) => {
              if (downX !== null && Math.abs(event.clientX - downX) > CLICK_DRAG_TOLERANCE_PX) {
                return;
              }

              const index = u.cursor.idx;
              if (index == null) {
                return;
              }

              const point = dataRef.current[index];
              if (point) {
                onPointSelectRef.current?.(point);
              }
            });

            u.over.addEventListener('dblclick', () => {
              onZoomWindowChangeRef.current?.(null);
            });
          },
        ],
      },
    };

    const chart = new uPlot(options, [xs, ys], element);
    chartRef.current = chart;

    return () => {
      chartRef.current = null;
      chart.destroy();
    };
  }, [
    colorMode,
    data,
    dimensions.height,
    dimensions.width,
    glucoseUnit,
    renderMode,
    selectedReadingIds,
    timeWindow.from,
    timeWindow.to,
    yMax,
  ]);

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-editable={editable || undefined}
      className="flex min-w-0 flex-col"
      style={{ height }}
    >
      <div className="ui_caption flex h-5 shrink-0 items-start justify-between gap-4 px-6 pt-2">
        <span className="shrink-0 text-text-primary">{glucoseUnit}</span>
        {onZoomWindowChange ? (
          <span className="ml-auto text-right text-text-soft opacity-60">Drag to zoom</span>
        ) : null}
      </div>
      <div
        ref={containerRef}
        aria-hidden
        className="min-h-0 min-w-0 flex-1"
      />
    </div>
  );
};
