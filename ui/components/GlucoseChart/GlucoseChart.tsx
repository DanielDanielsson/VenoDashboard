'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import { useRef, useEffect, useCallback, useState } from 'react';
import type {
  BasalChartPoint,
  ChartPoint,
  HealthStepChartPoint,
  TandemEventChartPoint,
  TimelineNote
} from '@/lib/glucose/types';
import { getGlucoseColor, type GlucoseColorMode } from '@/lib/glucose/tints';
import {
  NOTE_BAND_GAP,
  NOTE_BAND_PADDING_Y,
  NOTE_ROW_GAP,
  NOTE_ROW_HEIGHT,
  assignTimelineNoteLanes,
  getTimelineNoteBandHeight,
  getTimelineNotesAtTimestamp
} from '@/lib/glucose/timeline-note-layout';
import { HoverPanel } from '../HoverPanel';

export type { ChartPoint } from '@/lib/glucose/types';

interface GlucoseChartProps {
  data: ChartPoint[];
  basalData?: BasalChartPoint[];
  eventData?: TandemEventChartPoint[];
  stepData?: HealthStepChartPoint[];
  noteData?: TimelineNote[];
  height?: number;
  yMax?: number;
  colorMode: GlucoseColorMode;
  editable?: boolean;
  selectedReadingIds?: string[];
  selectedNoteId?: string | null;
  previewReadingValues?: Record<string, number>;
  onPointSelect?: (point: ChartPoint, additive: boolean) => void;
  onCorrectionPreviewChange?: (items: Array<{ readingId: string; valueMmolL: number }>) => void;
  onNoteSelect?: (note: TimelineNote) => void;
  onNoteAddRequest?: (hoveredAt: string | null) => void;
}

const LOW_THRESHOLD = 4.0;
const HIGH_THRESHOLD = 10.0;
const Y_MIN = 2.0;
const PADDING = { top: 32, right: 16, bottom: 48, left: 96 };
const BASAL_BAND_HEIGHT = 120;
const BASAL_BAND_GAP = 20;
const BASAL_TICK_COUNT = 3;
const STEP_BAND_HEIGHT = 120;
const STEP_BAND_GAP = 20;
const IOB_MARKER_MIN_SPACING = 36;
const EVENT_TRACK_HEIGHT = 120;
const EVENT_TRACK_GAP = 20;
const EVENT_LANE_COUNT = 3;
const EVENT_HOVER_WINDOW_MS = 3 * 60 * 1000;
const MAX_PX_PER_MS = 0.04;
const FIT_ALL_EPSILON = 0.001;
const STEP_TOTAL_FULL_LABEL_MIN_WIDTH_PX = 72;
const STEP_TOTAL_SUFFIX_MIN_WIDTH_PX = 58;
const STEP_TOTAL_LABEL_GAP_PX = 6;
const CORRECTED_COLOR_DARK = '#f472b6';
const CORRECTED_COLOR_LIGHT = '#db2777';
const TICK_INTERVALS_MS = [
  30 * 60 * 1000,
  60 * 60 * 1000,
  2 * 60 * 60 * 1000,
  4 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getDayStartMs(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getNextDayStartMs(dayStartMs: number): number {
  const date = new Date(dayStartMs);
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function pickTickInterval(visibleDurationMs: number, chartWidth: number): number {
  const minLabelGap = 96;

  for (const interval of TICK_INTERVALS_MS) {
    const tickCount = visibleDurationMs / interval;
    if (tickCount <= 1) {
      return interval;
    }

    if (chartWidth / tickCount >= minLabelGap) {
      return interval;
    }
  }

  return TICK_INTERVALS_MS[TICK_INTERVALS_MS.length - 1];
}

function findFirstIndexAtOrAfter(values: number[], target: number): number {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function findLastIndexAtOrBefore(values: number[], target: number): number {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low - 1;
}

function findNearestIndex(values: number[], target: number): number {
  if (values.length === 0) {
    return -1;
  }

  const nextIdx = findFirstIndexAtOrAfter(values, target);
  if (nextIdx <= 0) {
    return 0;
  }

  if (nextIdx >= values.length) {
    return values.length - 1;
  }

  const prevIdx = nextIdx - 1;
  return Math.abs(values[nextIdx] - target) < Math.abs(values[prevIdx] - target)
    ? nextIdx
    : prevIdx;
}

function getYAxisTicks(yMax: number): number[] {
  const range = yMax - Y_MIN;
  const targetTickCount = 8;
  const roughStep = range / targetTickCount;

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

  const step = 4;
  const ticks: number[] = [Y_MIN];
  for (let value = 4; value <= yMax; value += step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== yMax) {
    ticks.push(yMax);
  }

  return ticks;
}

function getBasalYMax(values: number[]): number {
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  if (maxValue <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(maxValue * 2) / 2);
}

function getBasalTicks(yMax: number): number[] {
  if (yMax <= 0) {
    return [];
  }

  return [0, yMax / 2, yMax].slice(0, BASAL_TICK_COUNT);
}

function getStepYMax(values: number[]): number {
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  if (maxValue <= 0) {
    return 0;
  }

  if (maxValue <= 1000) {
    return Math.max(250, Math.ceil(maxValue / 250) * 250);
  }

  if (maxValue <= 5000) {
    return Math.ceil(maxValue / 500) * 500;
  }

  return Math.ceil(maxValue / 1000) * 1000;
}

function getStepTicks(yMax: number): number[] {
  if (yMax <= 0) {
    return [];
  }

  return [0, yMax / 2, yMax];
}

function snapStrokeCoord(value: number): number {
  return Math.round(value) + 0.5;
}

function snapFillCoord(value: number): number {
  return Math.round(value);
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRenderedReadingColor(
  point: Pick<ChartPoint, 'valueMmolL' | 'isCorrected'> & { isPreviewCorrection?: boolean },
  colorMode: GlucoseColorMode,
  isDark: boolean,
  alpha = 1
): string {
  if (point.isCorrected || point.isPreviewCorrection) {
    return hexToRgba(isDark ? CORRECTED_COLOR_DARK : CORRECTED_COLOR_LIGHT, alpha);
  }

  return getGlucoseColor(point.valueMmolL, colorMode, alpha, isDark);
}

function getHoveredBasalPoint(
  hoveredTimestampMs: number,
  basalData: BasalChartPoint[],
  basalTimestamps: number[]
): BasalChartPoint | null {
  if (basalData.length < 2) {
    return null;
  }

  const activeIndex = findLastIndexAtOrBefore(basalTimestamps, hoveredTimestampMs);
  if (activeIndex < 0 || activeIndex >= basalData.length - 1) {
    return null;
  }

  const activeStartMs = basalTimestamps[activeIndex];
  const nextStartMs = basalTimestamps[activeIndex + 1];
  if (hoveredTimestampMs < activeStartMs || hoveredTimestampMs >= nextStartMs) {
    return null;
  }

  return basalData[activeIndex] ?? null;
}

function getHoveredTandemEvents(
  hoveredTimestampMs: number | null,
  eventData: TandemEventChartPoint[]
): TandemEventChartPoint[] {
  if (hoveredTimestampMs === null || eventData.length === 0) {
    return [];
  }

  return eventData.filter((event) => {
    const timestampMs = new Date(event.timestamp).getTime();
    return Math.abs(timestampMs - hoveredTimestampMs) <= EVENT_HOVER_WINDOW_MS;
  });
}

function getHoveredIobValue(
  timestampMs: number | null,
  points: { timestamp: string; iob: number | null }[]
): number | null {
  if (timestampMs === null || points.length === 0) return null;
  let closest: { timestamp: string; iob: number | null } | null = null;
  let closestDiff = Number.POSITIVE_INFINITY;
  for (const pt of points) {
    const diff = Math.abs(new Date(pt.timestamp).getTime() - timestampMs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = pt;
    }
  }
  return closest?.iob ?? null;
}

function getHoveredSuspendInterval(
  timestampMs: number | null,
  eventData: TandemEventChartPoint[]
): { suspendMs: number; resumeMs: number | null } | null {
  if (timestampMs === null) return null;
  const sorted = [...eventData].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].eventName !== 'PumpingSuspended') continue;
    const suspendMs = new Date(sorted[i].timestamp).getTime();
    const resumeEvent = sorted.find((e, j) => j > i && e.eventName === 'PumpingResumed');
    const resumeMs = resumeEvent ? new Date(resumeEvent.timestamp).getTime() : null;
    if (timestampMs >= suspendMs && (resumeMs === null || timestampMs <= resumeMs)) {
      return { suspendMs, resumeMs };
    }
  }
  return null;
}

function getHoveredStepBucket(
  hoveredTimestampMs: number | null,
  stepData: HealthStepChartPoint[]
): HealthStepChartPoint | null {
  if (hoveredTimestampMs === null || stepData.length === 0) {
    return null;
  }

  for (const bucket of stepData) {
    const bucketStartMs = new Date(bucket.bucketStart).getTime();
    const bucketEndMs = new Date(bucket.bucketEnd).getTime();
    if (hoveredTimestampMs >= bucketStartMs && hoveredTimestampMs < bucketEndMs) {
      return bucket;
    }
  }

  return null;
}

function buildVisibleStepDaySummaries({
  stepData,
  visibleStartMs,
  visibleEndMs,
  timeStartMs,
  chartWidth,
  pxPerMs,
  scroll,
}: {
  stepData: HealthStepChartPoint[];
  visibleStartMs: number;
  visibleEndMs: number;
  timeStartMs: number;
  chartWidth: number;
  pxPerMs: number;
  scroll: number;
}): Array<{ dayStartMs: number; segmentLeft: number; segmentWidth: number; totalSteps: number }> {
  if (stepData.length === 0 || chartWidth <= 0 || pxPerMs <= 0 || visibleEndMs <= visibleStartMs) {
    return [];
  }

  const totalsByDay = new Map<number, number>();
  for (const bucket of stepData) {
    const dayStartMs = getDayStartMs(new Date(bucket.bucketStart).getTime());
    totalsByDay.set(dayStartMs, (totalsByDay.get(dayStartMs) ?? 0) + bucket.stepCount);
  }

  const summaries: Array<{ dayStartMs: number; segmentLeft: number; segmentWidth: number; totalSteps: number }> = [];
  const firstDayStartMs = getDayStartMs(visibleStartMs);

  for (let dayStartMs = firstDayStartMs; dayStartMs <= visibleEndMs;) {
    const totalSteps = totalsByDay.get(dayStartMs);
    const dayEndMs = getNextDayStartMs(dayStartMs);

    if (totalSteps === undefined) {
      dayStartMs = dayEndMs;
      continue;
    }

    const segmentStartMs = Math.max(dayStartMs, visibleStartMs);
    const segmentEndMs = Math.min(dayEndMs, visibleEndMs);

    if (segmentEndMs <= segmentStartMs) {
      dayStartMs = dayEndMs;
      continue;
    }

    const rawLeft = PADDING.left + (segmentStartMs - timeStartMs) * pxPerMs - scroll;
    const rawRight = PADDING.left + (segmentEndMs - timeStartMs) * pxPerMs - scroll;
    const segmentLeft = clamp(rawLeft, PADDING.left, PADDING.left + chartWidth);
    const segmentRight = clamp(rawRight, PADDING.left, PADDING.left + chartWidth);
    const segmentWidth = Math.max(0, segmentRight - segmentLeft);

    if (segmentWidth <= 0) {
      continue;
    }

    summaries.push({
      dayStartMs,
      segmentLeft,
      segmentWidth,
      totalSteps,
    });

    dayStartMs = dayEndMs;
  }

  return summaries;
}

function formatCompactStepTotal(stepCount: number): string {
  if (stepCount < 1_000) {
    return stepCount.toString();
  }

  if (stepCount < 10_000) {
    const compactValue = Math.round((stepCount / 1_000) * 10) / 10;
    return `${compactValue % 1 === 0 ? compactValue.toFixed(0) : compactValue.toFixed(1)}k`;
  }

  if (stepCount < 1_000_000) {
    return `${Math.round(stepCount / 1_000)}k`;
  }

  const compactValue = Math.round((stepCount / 1_000_000) * 10) / 10;
  return `${compactValue % 1 === 0 ? compactValue.toFixed(0) : compactValue.toFixed(1)}m`;
}

function buildVisibleStepDayLabels(
  summaries: Array<{ dayStartMs: number; segmentLeft: number; segmentWidth: number; totalSteps: number }>
): Array<{ dayStartMs: number; left: number; text: string }> {
  const labels: Array<{ dayStartMs: number; left: number; text: string }> = [];
  let previousRight = Number.NEGATIVE_INFINITY;

  for (const summary of summaries) {
    const useCompactNumber = summary.segmentWidth < STEP_TOTAL_FULL_LABEL_MIN_WIDTH_PX;
    const hideTotalSuffix = summary.segmentWidth < STEP_TOTAL_SUFFIX_MIN_WIDTH_PX;
    const labelValue = useCompactNumber
      ? formatCompactStepTotal(summary.totalSteps)
      : summary.totalSteps.toLocaleString();
    const text = hideTotalSuffix ? labelValue : `${labelValue} total`;
    const estimatedCharacterWidth = useCompactNumber ? 5.4 : 6.2;
    const estimatedTextWidth = Math.max(20, text.length * estimatedCharacterWidth);
    const right = summary.segmentLeft + summary.segmentWidth - 8;
    const left = Math.max(PADDING.left, right - estimatedTextWidth);

    if (left <= previousRight + STEP_TOTAL_LABEL_GAP_PX) {
      continue;
    }

    labels.push({
      dayStartMs: summary.dayStartMs,
      left,
      text,
    });
    previousRight = right;
  }

  return labels;
}

function getTandemEventVisual(eventName: string, isDark = true): {
  label: string;
  fill: string;
  stroke: string;
  shape: 'circle' | 'ring' | 'diamond' | 'square' | 'triangle';
} {
  switch (eventName) {
    case 'CartridgeFilled':
      return {
        label: 'Cartridge',
        fill: isDark ? 'rgba(148, 163, 184, 0.9)' : 'rgba(71, 85, 105, 0.85)',
        stroke: isDark ? 'rgba(203, 213, 225, 1)' : 'rgba(51, 65, 85, 1)',
        shape: 'circle'
      };
    case 'BolusCompleted':
      return {
        label: 'Bolus',
        fill: isDark ? 'rgba(96, 165, 250, 0.95)' : 'rgba(37, 99, 235, 0.9)',
        stroke: isDark ? 'rgba(147, 197, 253, 1)' : 'rgba(29, 78, 216, 1)',
        shape: 'circle'
      };
    case 'BGReading':
      return {
        label: 'BG',
        fill: 'rgba(14, 165, 233, 0.22)',
        stroke: 'rgba(125, 211, 252, 0.98)',
        shape: 'ring'
      };
    case 'PumpingSuspended':
      return {
        label: 'Suspend',
        fill: 'rgba(244, 63, 94, 0.95)',
        stroke: 'rgba(251, 113, 133, 1)',
        shape: 'diamond'
      };
    case 'PumpingResumed':
      return {
        label: 'Resume',
        fill: 'rgba(52, 211, 153, 0.95)',
        stroke: 'rgba(110, 231, 183, 1)',
        shape: 'diamond'
      };
    case 'UserModeChange':
    case 'PCMChange':
      return {
        label: 'Mode',
        fill: 'rgba(96, 165, 250, 0.95)',
        stroke: 'rgba(147, 197, 253, 1)',
        shape: 'square'
      };
    case 'CarbsEntered':
      return {
        label: 'Carbs',
        fill: 'rgba(249, 115, 22, 0.95)',
        stroke: 'rgba(251, 146, 60, 1)',
        shape: 'square'
      };
    default:
      return {
        label: 'Fill',
        fill: 'rgba(226, 232, 240, 0.95)',
        stroke: 'rgba(248, 250, 252, 1)',
        shape: 'triangle'
      };
  }
}

function formatTandemEventSummary(event: TandemEventChartPoint): string | null {
  if (event.carbsGrams != null) {
    return `${Math.round(event.carbsGrams)} g`;
  }

  if (event.insulinDelivered != null) {
    return `${event.insulinDelivered.toFixed(1)} U`;
  }

  if (event.glucoseMmolL != null) {
    return `${event.glucoseMmolL.toFixed(1)} mmol/L`;
  }

  if (event.iob != null) {
    return `IOB ${event.iob.toFixed(1)} U`;
  }

  return null;
}

const SUPPRESSED_EVENT_NAMES = new Set([
  'BolusDelivery',
  'BGReading',
  'UserModeChange',
  'PCMChange',
  'PumpingSuspended',
  'PumpingResumed',
  'TubingFilled',
]);

const GLUCOSE_ICON_PATH1 = 'M125.711 125.711C153.097 98.3253 153.097 53.9246 125.711 26.5391C98.3256 -0.846376 53.9249 -0.846376 26.5394 26.5391C-0.84609 53.9246 -0.846104 98.3253 26.5394 125.711L22.2967 129.953L21.6048 129.253C-7.20186 99.7071 -7.20159 52.5419 21.6055 22.996L22.2967 22.2965C52.0254 -7.43216 100.225 -7.43216 129.954 22.2965L130.645 22.996C159.681 52.7765 159.45 100.457 129.954 129.953L129.254 130.645C99.4737 159.68 51.7932 159.45 22.2967 129.953L26.5394 125.711C53.9249 153.096 98.3256 153.096 125.711 125.711Z';
const GLUCOSE_ICON_PATH2 = 'M183.914 76.3893L127.872 20.3469C168.804 66.0228 146.708 112.027 129.84 130.17L183.914 76.3893Z';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const GLUCOSE_POINT_HIT_RADIUS_PX = 14;

function roundPreviewValue(value: number): number {
  return Number(value.toFixed(1));
}

function clampPreviewValue(value: number, yMax: number): number {
  return clamp(roundPreviewValue(value), 0.1, Math.max(yMax, Y_MIN));
}

function drawTandemMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  eventName: string,
  highlighted: boolean,
  visibleDurationMs: number,
  insulinDelivered: number | null,
  isDark: boolean
): void {
  const visual = getTandemEventVisual(eventName, isDark);
  const detailed = visibleDurationMs <= THREE_DAYS_MS;
  const baseSize = detailed ? 28 : 14;
  const size = highlighted ? baseSize + 4 : baseSize;
  const iconW = 184;
  const iconH = 153;
  const scale = size / iconW;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.translate(-(iconW * scale) / 2, -(iconH * scale) / 2);
  ctx.scale(scale, scale);

  ctx.fillStyle = visual.fill;
  ctx.fill(new Path2D(GLUCOSE_ICON_PATH1));
  ctx.fill(new Path2D(GLUCOSE_ICON_PATH2));

  ctx.restore();

  // Draw units label centred inside the circle when zoomed in enough
  if (insulinDelivered !== null && size >= 26) {
    const circleCenterX = x - 0.5 * scale;
    const circleCenterY = y + 16 * scale;
    const fontSize = Math.max(7, Math.round(size * 0.32));
    ctx.font = `bold ${fontSize}px var(--font-plex-mono), monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = visual.fill;
    ctx.fillText(insulinDelivered.toFixed(1), circleCenterX, circleCenterY);
  }
}

export function GlucoseChart({
  data,
  basalData = [],
  eventData = [],
  stepData = [],
  noteData = [],
  height = 400,
  yMax = 25,
  colorMode,
  editable = false,
  selectedReadingIds = [],
  selectedNoteId = null,
  previewReadingValues = {},
  onPointSelect,
  onCorrectionPreviewChange,
  onNoteSelect,
  onNoteAddRequest
}: GlucoseChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef(0);
  const pxPerMsRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<'pan' | 'edit' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(0);
  const dragScrollRef = useRef(0);
  const dragMovedRef = useRef(false);
  const editDragRef = useRef<{ readingId: string; baselineValueMmolL: number; index: number } | null>(null);
  const rafRef = useRef<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredTimestampMs, setHoveredTimestampMs] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [draggedReadingId, setDraggedReadingId] = useState<string | null>(null);
  const [isEditDragging, setIsEditDragging] = useState(false);
  const viewportFrameRef = useRef<number>(0);
  const [, setViewportVersion] = useState(0);
  const dataSignatureRef = useRef('');
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('theme-dark')
      : true
  );

  useEffect(() => {
    const handleChange = () =>
      setIsDark(document.documentElement.classList.contains('theme-dark'));
    window.addEventListener('pulse-theme-change', handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener('pulse-theme-change', handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    setContainerWidth(container.clientWidth);
    return () => observer.disconnect();
  }, []);

  const timestamps = data.map((point) => new Date(point.timestamp).getTime());
  const renderedData = data.map((point) => {
    const readingId = point.readingId;
    const previewValue = readingId ? previewReadingValues[readingId] : undefined;

    if (previewValue === undefined) {
      return {
        ...point,
        isPreviewCorrection: false
      };
    }

    return {
      ...point,
      valueMmolL: previewValue,
      isPreviewCorrection: true
    };
  });
  const basalTimestamps = basalData.map((point) => new Date(point.timestamp).getTime());
  const timeStartMs = timestamps[0] ?? 0;
  const timeEndMs = timestamps[timestamps.length - 1] ?? timeStartMs;
  const totalDurationMs = Math.max(1, timeEndMs - timeStartMs);
  const chartWidth = Math.max(0, containerWidth - PADDING.left - PADDING.right);
  const chartHeight = Math.max(0, height - PADDING.top - PADDING.bottom);
  const hasBasalBand = basalData.length > 0;
  const hasEventTrack = eventData.length > 0;
  const hasStepBand = stepData.length > 0;
  const iobPoints = eventData
    .filter((e) => e.iob !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const basalBandHeight = hasBasalBand ? Math.min(BASAL_BAND_HEIGHT, Math.max(64, chartHeight * 0.4)) : 0;
  const basalGap = hasBasalBand ? BASAL_BAND_GAP : 0;
  const stepBandHeight = hasStepBand ? STEP_BAND_HEIGHT : 0;
  const stepGap = hasStepBand ? STEP_BAND_GAP : 0;
  const eventTrackHeight = hasEventTrack ? EVENT_TRACK_HEIGHT : 0;
  const eventGap = hasEventTrack ? EVENT_TRACK_GAP : 0;
  const assignedNoteItems = assignTimelineNoteLanes(noteData);
  const noteBandHeight = getTimelineNoteBandHeight(noteData);
  const glucosePlotHeight = 240;
  const eventTrackTop = PADDING.top + glucosePlotHeight + eventGap;
  const basalBandTop = eventTrackTop + eventTrackHeight + basalGap;
  const stepBandTop = basalBandTop + basalBandHeight + stepGap;
  const noteAnchorBottom = hasStepBand
    ? stepBandTop + stepBandHeight
    : hasBasalBand
      ? basalBandTop + basalBandHeight
      : hasEventTrack
        ? eventTrackTop + eventTrackHeight
        : PADDING.top + glucosePlotHeight;
  const noteBandTop = noteAnchorBottom + NOTE_BAND_GAP;
  const fitAllPxPerMs = chartWidth > 0 ? chartWidth / totalDurationMs : 0;
  const minPxPerMs = fitAllPxPerMs > 0 ? fitAllPxPerMs : 0;
  const hoveredPoint = hoveredIndex === null ? null : renderedData[hoveredIndex] ?? null;
  const selectedReadingIdSet = new Set(selectedReadingIds);
  const hoveredBasalPoint =
    hoveredPoint && basalTimestamps.length > 0
      ? getHoveredBasalPoint(
          new Date(hoveredPoint.timestamp).getTime(),
          basalData,
          basalTimestamps
        )
      : null;
  const hoveredEventItems = getHoveredTandemEvents(hoveredTimestampMs, eventData).filter(
    (e) => !SUPPRESSED_EVENT_NAMES.has(e.eventName)
  );
  const hoveredStepBucket = getHoveredStepBucket(hoveredTimestampMs, stepData);
  const hoveredSuspendInterval = getHoveredSuspendInterval(hoveredTimestampMs, eventData);
  const hoveredIobValue = getHoveredIobValue(hoveredTimestampMs, iobPoints);
  const hoveredNotes = hoveredTimestampMs === null
    ? []
    : getTimelineNotesAtTimestamp(assignedNoteItems, hoveredTimestampMs);
  const viewportPxPerMs = pxPerMsRef.current > 0 ? pxPerMsRef.current : fitAllPxPerMs;
  const viewportTotalContentWidth = totalDurationMs * viewportPxPerMs;
  const viewportScroll = viewportPxPerMs > 0
    ? clamp(scrollRef.current, 0, Math.max(0, viewportTotalContentWidth - chartWidth))
    : 0;
  const visibleStartMs = viewportPxPerMs > 0
    ? timeStartMs + viewportScroll / viewportPxPerMs
    : timeStartMs;
  const visibleEndMs = viewportPxPerMs > 0
    ? Math.min(timeEndMs, visibleStartMs + chartWidth / viewportPxPerMs)
    : timeStartMs;
  const visibleStepDaySummaries = hasStepBand
    ? buildVisibleStepDaySummaries({
        stepData,
        visibleStartMs,
        visibleEndMs,
        timeStartMs,
        chartWidth,
        pxPerMs: viewportPxPerMs,
        scroll: viewportScroll,
      })
    : [];
  const visibleStepDayLabels = buildVisibleStepDayLabels(visibleStepDaySummaries);
  const stepTotalLabelColor = isDark ? 'rgba(253, 224, 71, 0.96)' : 'rgba(160, 90, 0, 0.92)';

  const syncViewportOverlay = useCallback(() => {
    if (viewportFrameRef.current) {
      return;
    }

    viewportFrameRef.current = requestAnimationFrame(() => {
      viewportFrameRef.current = 0;
      setViewportVersion((version) => version + 1);
    });
  }, []);

  useEffect(() => {
    if (data.length > 1 && chartWidth > 0 && fitAllPxPerMs > 0) {
      const signature = `${timeStartMs}:${timeEndMs}:${data.length}`;
      if (signature !== dataSignatureRef.current) {
        dataSignatureRef.current = signature;
        pxPerMsRef.current = fitAllPxPerMs;
        scrollRef.current = 0;
      } else if (pxPerMsRef.current <= fitAllPxPerMs * (1 + FIT_ALL_EPSILON)) {
        pxPerMsRef.current = fitAllPxPerMs;
        scrollRef.current = 0;
      } else if (pxPerMsRef.current < fitAllPxPerMs) {
        pxPerMsRef.current = fitAllPxPerMs;
      }

      syncViewportOverlay();
    }
  }, [data.length, chartWidth, fitAllPxPerMs, syncViewportOverlay, timeEndMs, timeStartMs]);

  useEffect(() => {
    return () => {
      if (viewportFrameRef.current) {
        cancelAnimationFrame(viewportFrameRef.current);
      }
    };
  }, []);

  function getTimestampMsForCanvasX(mouseX: number): number | null {
    if (chartWidth <= 0 || pxPerMsRef.current <= 0) {
      return null;
    }

    const clampedMouseX = clamp(mouseX - PADDING.left, 0, chartWidth);
    return timeStartMs + (clampedMouseX + scrollRef.current) / pxPerMsRef.current;
  }

  function getXForTimestamp(timestampMs: number): number {
    return PADDING.left + (timestampMs - timeStartMs) * pxPerMsRef.current - scrollRef.current;
  }

  function updateHoverAtPosition(mouseX: number, mouseY: number) {
    const targetTimeMs = getTimestampMsForCanvasX(mouseX);
    if (targetTimeMs === null) {
      setHoveredIndex(null);
      setHoveredTimestampMs(null);
      return;
    }

    const nearestIndex = findNearestIndex(timestamps, targetTimeMs);
    if (nearestIndex >= 0) {
      setHoveredIndex(nearestIndex);
      setHoveredTimestampMs(targetTimeMs);
      setHoverPos({ x: mouseX, y: mouseY });
    } else {
      setHoveredIndex(null);
      setHoveredTimestampMs(null);
    }
  }

  const clampScroll = useCallback(() => {
    const maxAllowed = Math.max(0, totalDurationMs * pxPerMsRef.current - chartWidth);
    scrollRef.current = clamp(scrollRef.current, 0, maxAllowed);
  }, [chartWidth, totalDurationMs]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length || chartWidth <= 0 || chartHeight <= 0 || pxPerMsRef.current <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, containerWidth, height);

    const pxPerMs = pxPerMsRef.current;
    const totalContentWidth = totalDurationMs * pxPerMs;
    const maxVisibleScroll = Math.max(0, totalContentWidth - chartWidth);
    const scroll = clamp(scrollRef.current, 0, maxVisibleScroll);
    scrollRef.current = scroll;

    const visibleStartMs = timeStartMs + scroll / pxPerMs;
    const visibleEndMs = Math.min(timeEndMs, visibleStartMs + chartWidth / pxPerMs);
    const startIdx = Math.max(0, findFirstIndexAtOrAfter(timestamps, visibleStartMs) - 1);
    const endIdx = Math.min(data.length - 1, findLastIndexAtOrBefore(timestamps, visibleEndMs) + 1);

    function xForTimestamp(timestampMs: number): number {
      return PADDING.left + (timestampMs - timeStartMs) * pxPerMs - scroll;
    }

    function yForValue(value: number): number {
      const clamped = clamp(value, Y_MIN, yMax);
      return PADDING.top + glucosePlotHeight * (1 - (clamped - Y_MIN) / (yMax - Y_MIN));
    }

    const style = getComputedStyle(document.documentElement);
    const textSoft = style.getPropertyValue('--text-soft').trim() || '#64748b';
    const textDim = style.getPropertyValue('--text-dim').trim() || '#94a3b8';
    const border = style.getPropertyValue('--border').trim() || 'rgba(148,163,184,0.1)';
    const basalBandBg      = isDark ? 'rgba(14, 165, 233, 0.07)'  : 'rgba(2, 100, 180, 0.1)';
    const basalBandBorder  = isDark ? 'rgba(56, 189, 248, 0.18)'  : 'rgba(2, 100, 180, 0.3)';
    const basalTickLine    = isDark ? 'rgba(56, 189, 248, 0.08)'  : 'rgba(2, 100, 180, 0.18)';
    const basalTickLabel   = isDark ? 'rgba(125, 211, 252, 0.88)' : 'rgba(2, 80, 150, 0.9)';
    const basalFillTop     = isDark ? 'rgba(56, 189, 248, 0.48)'  : 'rgba(2, 100, 180, 0.55)';
    const basalFillBottom  = isDark ? 'rgba(14, 165, 233, 0.14)'  : 'rgba(2, 100, 180, 0.2)';
    const basalDeliveryMk  = isDark ? 'rgba(186, 230, 253, 0.95)' : 'rgba(2, 80, 150, 0.75)';
    const basalOtherMk     = isDark ? 'rgba(125, 211, 252, 0.5)'  : 'rgba(2, 80, 150, 0.45)';
    const basalStroke      = isDark ? 'rgba(186, 230, 253, 0.96)' : 'rgba(2, 80, 150, 0.75)';

    const stepBandBg       = isDark ? 'rgba(245, 158, 11, 0.07)'  : 'rgba(160, 90, 0, 0.1)';
    const stepBandBorder   = isDark ? 'rgba(251, 191, 36, 0.18)'  : 'rgba(160, 90, 0, 0.3)';
    const stepTickLine     = isDark ? 'rgba(251, 191, 36, 0.08)'  : 'rgba(160, 90, 0, 0.18)';
    const stepTickLabel    = isDark ? 'rgba(253, 230, 138, 0.88)' : 'rgba(120, 70, 0, 0.9)';
    const stepFillTop      = isDark ? 'rgba(251, 191, 36, 0.52)'  : 'rgba(160, 90, 0, 0.55)';
    const stepFillBottom   = isDark ? 'rgba(245, 158, 11, 0.18)'  : 'rgba(160, 90, 0, 0.2)';
    const stepBarOutline   = isDark ? 'rgba(253, 224, 71, 0.45)'  : 'rgba(160, 90, 0, 0.45)';
    const stepBarHovered   = isDark ? 'rgba(254, 240, 138, 1)'    : 'rgba(120, 60, 0, 0.9)';

    const yLow = yForValue(LOW_THRESHOLD);
    const yHigh = yForValue(HIGH_THRESHOLD);
    const firstDayStartMs = getDayStartMs(visibleStartMs);

    let dayIndex = 0;
    for (let dayStartMs = firstDayStartMs; dayStartMs <= visibleEndMs;) {
      const nextDayStartMs = getNextDayStartMs(dayStartMs);
      const segmentStartMs = Math.max(dayStartMs, visibleStartMs);
      const segmentEndMs = Math.min(nextDayStartMs, visibleEndMs);

      if (segmentEndMs <= segmentStartMs) {
        dayStartMs = nextDayStartMs;
        dayIndex += 1;
        continue;
      }

      if (dayIndex % 2 === 0) {
        const bandX = xForTimestamp(segmentStartMs);
        const bandWidth = (segmentEndMs - segmentStartMs) * pxPerMs;
        ctx.fillStyle = 'rgba(148, 163, 184, 0.025)';
        ctx.fillRect(bandX, PADDING.top, bandWidth, chartHeight);
      }

      dayStartMs = nextDayStartMs;
      dayIndex += 1;
    }

    ctx.fillStyle = 'rgba(52, 211, 153, 0.06)';
    ctx.fillRect(PADDING.left, yHigh, chartWidth, yLow - yHigh);

    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;

    ctx.strokeStyle = getGlucoseColor(LOW_THRESHOLD, colorMode, 0.3, isDark);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, yLow);
    ctx.lineTo(PADDING.left + chartWidth, yLow);
    ctx.stroke();

    ctx.strokeStyle = getGlucoseColor(HIGH_THRESHOLD, colorMode, 0.3, isDark);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, yHigh);
    ctx.lineTo(PADDING.left + chartWidth, yHigh);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '10px var(--font-plex-mono), monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = textSoft;
    ctx.fillText('mmol/L', 8, PADDING.top - 4);

    ctx.font = '11px var(--font-plex-mono), monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTicks = getYAxisTicks(yMax);
    for (const tick of yTicks) {
      const y = yForValue(tick);
      ctx.fillStyle = tick === LOW_THRESHOLD || tick === HIGH_THRESHOLD ? 'rgba(255,255,255,0.5)' : textSoft;
      ctx.fillText(tick.toString(), PADDING.left - 10, y);

      ctx.strokeStyle = border;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(PADDING.left + chartWidth, y);
      ctx.stroke();
    }

    if (hasEventTrack && eventTrackHeight > 0) {
      const visibleEventItems = eventData.filter((event) => {
        if (SUPPRESSED_EVENT_NAMES.has(event.eventName)) return false;
        const timestampMs = new Date(event.timestamp).getTime();
        return timestampMs >= visibleStartMs && timestampMs <= visibleEndMs;
      });

      const trackMidY = eventTrackTop + eventTrackHeight / 2;

      ctx.fillStyle = 'rgba(148, 163, 184, 0.035)';
      ctx.fillRect(PADDING.left, eventTrackTop, chartWidth, eventTrackHeight);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, eventTrackTop);
      ctx.lineTo(PADDING.left + chartWidth, eventTrackTop);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '10px var(--font-plex-mono), monospace';
      ctx.fillStyle = textSoft;
      ctx.fillText('Tandem events', 8, eventTrackTop + 4);

      // Draw suspend intervals as red lines
      const sortedEvents = [...eventData].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      for (let i = 0; i < sortedEvents.length; i++) {
        if (sortedEvents[i].eventName !== 'PumpingSuspended') continue;
        const suspendMs = new Date(sortedEvents[i].timestamp).getTime();
        const resumeEvent = sortedEvents.find(
          (e, j) => j > i && e.eventName === 'PumpingResumed'
        );
        const resumeMs = resumeEvent
          ? new Date(resumeEvent.timestamp).getTime()
          : visibleEndMs;

        if (resumeMs < visibleStartMs || suspendMs > visibleEndMs) continue;

        const lineStartX = Math.max(xForTimestamp(suspendMs), PADDING.left);
        const lineEndX = Math.min(xForTimestamp(resumeMs), PADDING.left + chartWidth);

        if (lineEndX <= lineStartX) continue;

        ctx.strokeStyle = isDark ? 'rgba(251, 113, 133, 0.9)' : 'rgba(190, 18, 60, 0.85)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const suspendLineY = eventTrackTop + eventTrackHeight - 10;
        ctx.moveTo(lineStartX, suspendLineY);
        ctx.lineTo(lineEndX, suspendLineY);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }

      const eventVisibleDurationMs = visibleEndMs - visibleStartMs;
      const detailedView = eventVisibleDurationMs <= THREE_DAYS_MS;
      const dynamicSpacing = detailedView ? 32 : 18;
      const laneLastX = Array.from({ length: EVENT_LANE_COUNT }, () => Number.NEGATIVE_INFINITY);

      // Separate bolus events for clustering; draw others with lane logic
      const bolusEvents: typeof visibleEventItems = [];
      const otherEvents: typeof visibleEventItems = [];
      for (const event of visibleEventItems) {
        if (event.eventName === 'BolusCompleted') {
          bolusEvents.push(event);
        } else {
          otherEvents.push(event);
        }
      }

      for (const event of otherEvents) {
        const timestampMs = new Date(event.timestamp).getTime();
        const x = snapFillCoord(xForTimestamp(timestampMs));
        let laneIndex = 0;

        while (
          laneIndex < EVENT_LANE_COUNT - 1 &&
          x - laneLastX[laneIndex] < dynamicSpacing
        ) {
          laneIndex += 1;
        }

        laneLastX[laneIndex] = x;
        const laneOffset = (laneIndex - (EVENT_LANE_COUNT - 1) / 2) * 28;
        const y = trackMidY + laneOffset;
        const highlighted = hoveredEventItems.some(
          (hoveredEvent) =>
            hoveredEvent.timestamp === event.timestamp &&
            hoveredEvent.eventName === event.eventName
        );

        drawTandemMarker(ctx, x, y, event.eventName, highlighted, eventVisibleDurationMs, event.insulinDelivered ?? null, isDark);
      }

      // Cluster nearby bolus events and sum their insulin delivered
      if (bolusEvents.length > 0) {
        const bolusClusters: { x: number; t: number; insulinSum: number }[] = [];
        for (const event of bolusEvents) {
          const t = new Date(event.timestamp).getTime();
          const x = snapFillCoord(xForTimestamp(t));
          const insulin = event.insulinDelivered ?? 0;
          const last = bolusClusters[bolusClusters.length - 1];
          if (last && x - last.x < IOB_MARKER_MIN_SPACING) {
            last.insulinSum += insulin;
          } else {
            bolusClusters.push({ x, t, insulinSum: insulin });
          }
        }

        for (const cluster of bolusClusters) {
          const isHovered = hoveredEventItems.some(
            (he) => he.eventName === 'BolusCompleted' &&
              Math.abs(new Date(he.timestamp).getTime() - cluster.t) <= EVENT_HOVER_WINDOW_MS
          );
          drawTandemMarker(ctx, cluster.x, trackMidY, 'BolusCompleted', isHovered, eventVisibleDurationMs, cluster.insulinSum, isDark);
        }
      }
    }

    if (hasBasalBand && basalBandHeight > 0) {
      const basalStartIdx = basalTimestamps.length
        ? Math.max(0, findLastIndexAtOrBefore(basalTimestamps, visibleStartMs))
        : -1;
      const basalEndIdxRaw = findLastIndexAtOrBefore(basalTimestamps, visibleEndMs);
      const basalEndIdx =
        basalEndIdxRaw < 0
          ? -1
          : Math.min(basalData.length - 1, basalEndIdxRaw + 1);
      const visibleBasal =
        basalStartIdx >= 0 && basalEndIdx >= basalStartIdx
          ? basalData.slice(basalStartIdx, basalEndIdx + 1)
          : [];
      const visibleBasalValues = visibleBasal.map((point) => point.basalRateUnitsPerHour);
      const basalYMax = getBasalYMax(visibleBasalValues);

      ctx.fillStyle = basalBandBg;
      ctx.fillRect(PADDING.left, basalBandTop, chartWidth, basalBandHeight);

      ctx.strokeStyle = basalBandBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, basalBandTop);
      ctx.lineTo(PADDING.left + chartWidth, basalBandTop);
      ctx.stroke();

      if (basalYMax > 0) {
        const basalTicks = getBasalTicks(basalYMax);

        ctx.font = '10px var(--font-plex-mono), monospace';
        for (const tick of basalTicks) {
          const y =
            basalBandTop + basalBandHeight - (tick / basalYMax) * basalBandHeight;
          ctx.strokeStyle = basalTickLine;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(PADDING.left, y);
          ctx.lineTo(PADDING.left + chartWidth, y);
          ctx.stroke();

          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = basalTickLabel;
          ctx.fillText(tick.toFixed(tick % 1 === 0 ? 0 : 1), PADDING.left - 8, y);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = textSoft;
        ctx.fillText('Basal U/hr', 8, basalBandTop + 4);

        ctx.save();
        ctx.beginPath();
        ctx.rect(PADDING.left, basalBandTop, chartWidth, basalBandHeight);
        ctx.clip();

        const basalFloorY = basalBandTop + basalBandHeight - 2;
        const basalFill = ctx.createLinearGradient(0, basalBandTop, 0, basalFloorY);
        basalFill.addColorStop(0, basalFillTop);
        basalFill.addColorStop(1, basalFillBottom);

        let hasBasalPath = false;
        let previousStepEndX: number | null = null;
        ctx.beginPath();
        for (let i = 0; i < visibleBasal.length; i += 1) {
          const point = visibleBasal[i];
          const timestampMs = basalTimestamps[basalStartIdx + i];
          const nextTimestampMs =
            i + 1 < visibleBasal.length
              ? basalTimestamps[basalStartIdx + i + 1]
              : null;
          if (nextTimestampMs === null) {
            continue;
          }
          const clampedStartMs = Math.max(timestampMs, visibleStartMs);
          const clampedEndMs = Math.min(nextTimestampMs, visibleEndMs);

          if (clampedEndMs <= clampedStartMs) {
            continue;
          }

          const startX = snapFillCoord(xForTimestamp(clampedStartMs));
          const endX = snapFillCoord(xForTimestamp(clampedEndMs));
          const width = Math.max(1, endX - startX);
          const barHeight = Math.max(
            2,
            (point.basalRateUnitsPerHour / basalYMax) * (basalBandHeight - 8)
          );
          const fillY = snapFillCoord(basalFloorY - barHeight);
          const strokeY = snapStrokeCoord(fillY);

          ctx.fillStyle = basalFill;
          ctx.fillRect(startX, fillY, width, basalFloorY - fillY);

          if (!hasBasalPath) {
            ctx.moveTo(snapStrokeCoord(startX), strokeY);
            hasBasalPath = true;
          } else {
            const stepStartX = snapStrokeCoord(startX);
            if (previousStepEndX !== null && previousStepEndX !== stepStartX) {
              ctx.lineTo(previousStepEndX, strokeY);
            }
            ctx.lineTo(stepStartX, strokeY);
          }
          previousStepEndX = snapStrokeCoord(endX);
          ctx.lineTo(previousStepEndX, strokeY);

          if (timestampMs >= visibleStartMs && timestampMs <= visibleEndMs) {
            ctx.fillStyle =
              point.eventName === 'BasalDelivery'
                ? basalDeliveryMk
                : basalOtherMk;
            const markerX = snapFillCoord(Math.max(PADDING.left, startX));
            ctx.fillRect(markerX, fillY - 4, 1, 4);
          }
        }

        if (hasBasalPath) {
          ctx.strokeStyle = basalStroke;
          ctx.lineWidth = 1.25;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        ctx.restore();
      } else {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = '10px var(--font-plex-mono), monospace';
        ctx.fillStyle = textSoft;
        ctx.fillText('Basal U/hr', 8, basalBandTop + 4);
      }
    }

    if (hasStepBand && stepBandHeight > 0) {
      const visibleStepBuckets = stepData.filter((bucket) => {
        const bucketStartMs = new Date(bucket.bucketStart).getTime();
        const bucketEndMs = new Date(bucket.bucketEnd).getTime();
        return bucketEndMs > visibleStartMs && bucketStartMs < visibleEndMs;
      });
      const stepYMax = getStepYMax(visibleStepBuckets.map((bucket) => bucket.stepCount));

      ctx.fillStyle = stepBandBg;
      ctx.fillRect(PADDING.left, stepBandTop, chartWidth, stepBandHeight);

      ctx.strokeStyle = stepBandBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, stepBandTop);
      ctx.lineTo(PADDING.left + chartWidth, stepBandTop);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '10px var(--font-plex-mono), monospace';

      if (stepYMax > 0) {
        const stepTicks = getStepTicks(stepYMax);

        for (const tick of stepTicks) {
          const y =
            stepBandTop + stepBandHeight - (tick / stepYMax) * stepBandHeight;
          ctx.strokeStyle = stepTickLine;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(PADDING.left, y);
          ctx.lineTo(PADDING.left + chartWidth, y);
          ctx.stroke();

          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = stepTickLabel;
          ctx.fillText(tick.toFixed(0), PADDING.left - 8, y);
        }

        const stepFloorY = stepBandTop + stepBandHeight - 2;
        const stepFill = ctx.createLinearGradient(0, stepBandTop, 0, stepFloorY);
        stepFill.addColorStop(0, stepFillTop);
        stepFill.addColorStop(1, stepFillBottom);

        for (const bucket of visibleStepBuckets) {
          const bucketStartMs = new Date(bucket.bucketStart).getTime();
          const bucketEndMs = new Date(bucket.bucketEnd).getTime();
          const clampedStartMs = Math.max(bucketStartMs, visibleStartMs);
          const clampedEndMs = Math.min(bucketEndMs, visibleEndMs);

          if (clampedEndMs <= clampedStartMs) {
            continue;
          }

          const startX = snapFillCoord(xForTimestamp(clampedStartMs));
          const endX = snapFillCoord(xForTimestamp(clampedEndMs));
          const width = Math.max(2, endX - startX);
          const barHeight = Math.max(
            2,
            (bucket.stepCount / stepYMax) * (stepBandHeight - 8)
          );
          const fillY = snapFillCoord(stepFloorY - barHeight);

          ctx.fillStyle = stepFill;
          ctx.fillRect(startX, fillY, width, stepFloorY - fillY);

          ctx.strokeStyle =
            hoveredStepBucket &&
            hoveredStepBucket.bucketStart === bucket.bucketStart &&
            hoveredStepBucket.bucketEnd === bucket.bucketEnd
              ? stepBarHovered
              : stepBarOutline;
          ctx.lineWidth = 1;
          ctx.strokeRect(startX + 0.5, fillY + 0.5, Math.max(1, width - 1), Math.max(1, stepFloorY - fillY - 1));
        }
      } else {
        ctx.textBaseline = 'top';
        ctx.fillStyle = textSoft;
      }
    }

    // IOB markers (purple glucose drop icons in the event track)
    if (iobPoints.length > 0 && hasEventTrack && eventTrackHeight > 0) {
      const visibleIob = iobPoints.filter((pt) => {
        const t = new Date(pt.timestamp).getTime();
        return t >= visibleStartMs && t <= visibleEndMs && (pt.iob as number) > 0;
      });

      const iobFill   = isDark ? 'rgba(167, 139, 250, 0.9)' : 'rgba(109, 40, 217, 0.85)';
      const eventVisibleDurationMs = visibleEndMs - visibleStartMs;
      const detailed = eventVisibleDurationMs <= THREE_DAYS_MS;
      const iobBaseSize = detailed ? 28 : 14;
      const iobRow = eventTrackTop + eventTrackHeight - 28;

      // Cluster nearby IOB points and sum their values
      const iobClusters: { x: number; t: number; iobSum: number }[] = [];
      for (const pt of visibleIob) {
        const t = new Date(pt.timestamp).getTime();
        const x = snapFillCoord(xForTimestamp(t));
        const last = iobClusters[iobClusters.length - 1];
        if (last && x - last.x < IOB_MARKER_MIN_SPACING) {
          last.iobSum = pt.iob as number;
        } else {
          iobClusters.push({ x, t, iobSum: pt.iob as number });
        }
      }

      for (const cluster of iobClusters) {
        const isHovered = hoveredIobValue !== null && hoveredTimestampMs !== null &&
          Math.abs(cluster.t - hoveredTimestampMs) <= EVENT_HOVER_WINDOW_MS;
        const size = isHovered ? iobBaseSize + 4 : iobBaseSize;
        const iconW = 184;
        const iconH = 153;
        const scale = size / iconW;

        ctx.save();
        ctx.translate(cluster.x, iobRow);
        ctx.rotate(-Math.PI / 2);
        ctx.translate(-(iconW * scale) / 2, -(iconH * scale) / 2);
        ctx.scale(scale, scale);
        ctx.fillStyle = iobFill;
        ctx.fill(new Path2D(GLUCOSE_ICON_PATH1));
        ctx.fill(new Path2D(GLUCOSE_ICON_PATH2));
        ctx.restore();

        // Draw IOB value below the icon
        if (size >= 20) {
          const labelY = iobRow + 16 * scale;
          const fontSize = Math.max(7, Math.round(size * 0.32));
          ctx.font = `bold ${fontSize}px var(--font-plex-mono), monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = iobFill;
          ctx.fillText(cluster.iobSum.toFixed(1), cluster.x, labelY);
        }
      }
    }

    const visibleDurationMs = Math.max(1, visibleEndMs - visibleStartMs);
    const tickIntervalMs = pickTickInterval(visibleDurationMs, chartWidth);
    const firstTickMs = Math.ceil(visibleStartMs / tickIntervalMs) * tickIntervalMs;
    let previousDateLabel = '';

    for (let dayStartMs = firstDayStartMs; dayStartMs <= visibleEndMs; dayStartMs = getNextDayStartMs(dayStartMs)) {
      if (dayStartMs < visibleStartMs || dayStartMs > visibleEndMs) {
        continue;
      }

      const x = xForTimestamp(dayStartMs);
      if (x < PADDING.left || x > PADDING.left + chartWidth) {
        continue;
      }

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, PADDING.top + chartHeight);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let tickMs = firstTickMs; tickMs <= visibleEndMs; tickMs += tickIntervalMs) {
      const x = xForTimestamp(tickMs);
      if (x < PADDING.left || x > PADDING.left + chartWidth) continue;

      const date = new Date(tickMs);
      ctx.fillStyle = textDim;
      ctx.font = '11px var(--font-plex-mono), monospace';
      ctx.fillText(formatTime(date), x, height - PADDING.bottom + 8);

      const currentDateLabel = formatDate(date);
      const shouldShowDate =
        previousDateLabel !== currentDateLabel &&
        (date.getHours() === 0 || tickIntervalMs >= 12 * 60 * 60 * 1000);

      if (shouldShowDate) {
        ctx.fillStyle = textSoft;
        ctx.font = '10px var(--font-plex-mono), monospace';
        ctx.fillText(currentDateLabel, x, height - PADDING.bottom + 24);
        previousDateLabel = currentDateLabel;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(PADDING.left, PADDING.top - 4, chartWidth, chartHeight + 8);
    ctx.clip();

    if (endIdx > startIdx) {
      const gradient = ctx.createLinearGradient(0, PADDING.top, 0, PADDING.top + chartHeight);
      gradient.addColorStop(0, 'rgba(52, 211, 153, 0.12)');
      gradient.addColorStop(1, 'rgba(52, 211, 153, 0.01)');

      ctx.beginPath();
      ctx.moveTo(xForTimestamp(timestamps[startIdx]), PADDING.top + glucosePlotHeight);
      for (let i = startIdx; i <= endIdx; i++) {
        ctx.lineTo(xForTimestamp(timestamps[i]), yForValue(renderedData[i].valueMmolL));
      }
      ctx.lineTo(xForTimestamp(timestamps[endIdx]), PADDING.top + glucosePlotHeight);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = startIdx; i < endIdx; i++) {
      const x1 = xForTimestamp(timestamps[i]);
      const y1 = yForValue(renderedData[i].valueMmolL);
      const x2 = xForTimestamp(timestamps[i + 1]);
      const y2 = yForValue(renderedData[i + 1].valueMmolL);
      const lineColor =
        renderedData[i].isCorrected ||
        renderedData[i].isPreviewCorrection ||
        renderedData[i + 1].isCorrected ||
        renderedData[i + 1].isPreviewCorrection
          ? getRenderedReadingColor(
              {
                valueMmolL: renderedData[i].valueMmolL,
                isCorrected: renderedData[i].isCorrected,
                isPreviewCorrection: renderedData[i].isPreviewCorrection || renderedData[i + 1].isPreviewCorrection
              },
              colorMode,
              isDark
            )
          : getGlucoseColor((renderedData[i].valueMmolL + renderedData[i + 1].valueMmolL) / 2, colorMode, 1, isDark);

      ctx.strokeStyle = lineColor;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const showDots = pxPerMs * 5 * 60 * 1000 >= 6;
    if (showDots) {
      for (let i = startIdx; i <= endIdx; i++) {
        const x = xForTimestamp(timestamps[i]);
        const y = yForValue(renderedData[i].valueMmolL);
        const color = getRenderedReadingColor(renderedData[i], colorMode, isDark);
        const isShare = renderedData[i].source === 'share';

        ctx.beginPath();
        ctx.arc(x, y, isShare ? 2.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (isShare) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    for (let i = startIdx; i <= endIdx; i++) {
      const readingId = renderedData[i].readingId;
      if (!readingId || !selectedReadingIdSet.has(readingId)) {
        continue;
      }

      const x = xForTimestamp(timestamps[i]);
      const y = yForValue(renderedData[i].valueMmolL);
      const color = getRenderedReadingColor(renderedData[i], colorMode, isDark);

      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = style.getPropertyValue('--surface-strong').trim() || '#020817';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (hoveredIndex !== null && hoveredIndex >= startIdx && hoveredIndex <= endIdx) {
      const hoverX = xForTimestamp(timestamps[hoveredIndex]);
      const hoverY = yForValue(renderedData[hoveredIndex].valueMmolL);

      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverX, PADDING.top);
      ctx.lineTo(hoverX, PADDING.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(hoverX, hoverY, 4, 0, Math.PI * 2);
      ctx.fillStyle = style.getPropertyValue('--surface-strong').trim() || '#020817';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(hoverX, hoverY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = getRenderedReadingColor(renderedData[hoveredIndex], colorMode, isDark);
      ctx.fill();
    }

    ctx.restore();

    if (totalContentWidth > chartWidth + 1) {
      const barWidth = Math.max(40, (chartWidth / totalContentWidth) * chartWidth);
      const barX = maxVisibleScroll > 0
        ? PADDING.left + (scroll / maxVisibleScroll) * (chartWidth - barWidth)
        : PADDING.left;
      const barY = height - 4;

      ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, 3, 1.5);
      ctx.fill();
    }
  }, [
    basalBandHeight,
    basalBandTop,
    basalData,
    hasStepBand,
    chartHeight,
    chartWidth,
    colorMode,
    containerWidth,
    data.length,
    eventData,
    eventGap,
    eventTrackHeight,
    eventTrackTop,
    glucosePlotHeight,
    hasBasalBand,
    hasEventTrack,
    height,
    hoveredIndex,
    hoveredEventItems,
    hoveredStepBucket,
    hoveredSuspendInterval,
    stepBandHeight,
    stepBandTop,
    stepData,
    stepGap,
    timeEndMs,
    timeStartMs,
    timestamps,
    basalTimestamps,
    totalDurationMs,
    yMax,
    isDark,
    iobPoints,
    hoveredIobValue,
    renderedData,
    selectedReadingIds
  ]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (chartWidth <= 0 || totalDurationMs <= 0 || pxPerMsRef.current <= 0) {
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const mouseX = clamp(e.offsetX - PADDING.left, 0, chartWidth);
      const oldPxPerMs = pxPerMsRef.current;
      const targetTimeMs = timeStartMs + (scrollRef.current + mouseX) / oldPxPerMs;
      const newPxPerMs = clamp(oldPxPerMs * zoomFactor, minPxPerMs, MAX_PX_PER_MS);

      if (newPxPerMs <= fitAllPxPerMs * (1 + FIT_ALL_EPSILON)) {
        pxPerMsRef.current = fitAllPxPerMs;
        scrollRef.current = 0;
      } else {
        pxPerMsRef.current = newPxPerMs;
        scrollRef.current = (targetTimeMs - timeStartMs) * newPxPerMs - mouseX;
      }
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 0) {
      e.preventDefault();
      scrollRef.current += e.deltaX;
    } else {
      return;
    }

    clampScroll();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    syncViewportOverlay();
  }, [chartWidth, clampScroll, draw, fitAllPxPerMs, minPxPerMs, timeStartMs, totalDurationMs]);

  function getSelectablePointIndexAtClientPosition(clientX: number, clientY: number): number | null {
    const canvas = canvasRef.current;
    if (!canvas || !data.length || chartWidth <= 0 || pxPerMsRef.current <= 0) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    if (
      mouseX < PADDING.left ||
      mouseX > PADDING.left + chartWidth ||
      mouseY < PADDING.top ||
      mouseY > PADDING.top + chartHeight
    ) {
      return null;
    }

    const targetTimeMs = timeStartMs + (mouseX - PADDING.left + scrollRef.current) / pxPerMsRef.current;
    const nearestIndex = findNearestIndex(timestamps, targetTimeMs);
    if (nearestIndex < 0) {
      return null;
    }

    const xForTimestamp = (timestampMs: number): number =>
      PADDING.left + (timestampMs - timeStartMs) * pxPerMsRef.current - scrollRef.current;

    const yForValue = (value: number): number => {
      const clamped = clamp(value, Y_MIN, yMax);
      return PADDING.top + glucosePlotHeight * (1 - (clamped - Y_MIN) / (yMax - Y_MIN));
    };

    let bestIndex: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let offset = -3; offset <= 3; offset += 1) {
      const index = nearestIndex + offset;
      if (index < 0 || index >= data.length) {
        continue;
      }

      const point = renderedData[index];
      if (!point?.readingId) {
        continue;
      }

      const pointX = xForTimestamp(timestamps[index]);
      const pointY = yForValue(point.valueMmolL);
      const distance = Math.hypot(pointX - mouseX, pointY - mouseY);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestDistance > GLUCOSE_POINT_HIT_RADIUS_PX) {
      return null;
    }

    return bestIndex;
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const selectedIndex = getSelectablePointIndexAtClientPosition(e.clientX, e.clientY);
    const selectedPoint = selectedIndex === null ? null : renderedData[selectedIndex];

    isDraggingRef.current = true;
    setIsDragging(true);
    dragMovedRef.current = false;

    if (editable && selectedPoint?.readingId && selectedReadingIdSet.has(selectedPoint.readingId)) {
      dragModeRef.current = 'edit';
      dragStartRef.current = e.clientY;
      editDragRef.current = {
        readingId: selectedPoint.readingId,
        baselineValueMmolL: selectedPoint.valueMmolL,
        index: selectedIndex as number
      };
      setDraggedReadingId(selectedPoint.readingId);
      setIsEditDragging(true);
      setHoveredIndex(selectedIndex);
      setHoveredTimestampMs(new Date(selectedPoint.timestamp).getTime());
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    } else {
      dragModeRef.current = 'pan';
      dragStartRef.current = e.clientX;
      dragScrollRef.current = scrollRef.current;
      editDragRef.current = null;
      setDraggedReadingId(null);
      setIsEditDragging(false);
    }

    e.preventDefault();
  }, [chartHeight, chartWidth, editable, glucosePlotHeight, renderedData, selectedReadingIdSet, timeStartMs, timestamps, yMax]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length || chartWidth <= 0 || pxPerMsRef.current <= 0) return;

    if (isDraggingRef.current) {
      if (dragModeRef.current === 'edit' && editDragRef.current) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const deltaY = dragStartRef.current - e.clientY;
        if (Math.abs(deltaY) > 2) {
          dragMovedRef.current = true;
        }

        const valueDelta = (deltaY / glucosePlotHeight) * (yMax - Y_MIN);
        onCorrectionPreviewChange?.(
          [{
            readingId: editDragRef.current.readingId,
            valueMmolL: clampPreviewValue(editDragRef.current.baselineValueMmolL + valueDelta, yMax)
          }]
        );
        setHoveredIndex(editDragRef.current.index);
        setHoveredTimestampMs(new Date(renderedData[editDragRef.current.index]?.timestamp ?? '').getTime() || null);
        setHoverPos({ x: mouseX, y: mouseY });
      } else {
        const delta = dragStartRef.current - e.clientX;
        if (Math.abs(delta) > 4) {
          dragMovedRef.current = true;
        }
        scrollRef.current = dragScrollRef.current + delta;
        clampScroll();
      }

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
      syncViewportOverlay();
      if (dragModeRef.current !== 'edit') {
        setHoveredIndex(null);
        setHoveredTimestampMs(null);
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (
      mouseX < PADDING.left ||
      mouseX > PADDING.left + chartWidth ||
      mouseY < PADDING.top ||
      mouseY > PADDING.top + chartHeight
    ) {
      setHoveredIndex(null);
      setHoveredTimestampMs(null);
      return;
    }

    updateHoverAtPosition(mouseX, mouseY);
  }, [chartHeight, chartWidth, clampScroll, data.length, draw, glucosePlotHeight, onCorrectionPreviewChange, timestamps, yMax]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragModeRef.current === 'edit') {
      isDraggingRef.current = false;
      dragModeRef.current = null;
      editDragRef.current = null;
      setIsDragging(false);
      setIsEditDragging(false);
      setDraggedReadingId(null);
      dragMovedRef.current = false;
      return;
    }

    if (!dragMovedRef.current && editable) {
      const selectedIndex = getSelectablePointIndexAtClientPosition(e.clientX, e.clientY);
      const point = selectedIndex === null ? null : data[selectedIndex];
      if (point?.readingId) {
        onPointSelect?.(point, e.shiftKey);
      }
    }

    isDraggingRef.current = false;
    dragModeRef.current = null;
    editDragRef.current = null;
    setIsDragging(false);
    setIsEditDragging(false);
    setDraggedReadingId(null);
    dragMovedRef.current = false;
  }, [data, editable, onPointSelect]);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    dragModeRef.current = null;
    editDragRef.current = null;
    setIsDragging(false);
    setIsEditDragging(false);
    setDraggedReadingId(null);
    setHoveredIndex(null);
    setHoveredTimestampMs(null);
    dragMovedRef.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const touchStartRef = useRef<{ x: number; scroll: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, scroll: scrollRef.current };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      const delta = touchStartRef.current.x - e.touches[0].clientX;
      scrollRef.current = touchStartRef.current.scroll + delta;
      clampScroll();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
      syncViewportOverlay();
      setHoveredIndex(null);
      setHoveredTimestampMs(null);
    }
  }, [clampScroll, draw, syncViewportOverlay]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  function handleNoteBandMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    updateHoverAtPosition(event.clientX - rect.left + PADDING.left, event.clientY - rect.top + noteBandTop);
  }

  function handleNoteBandMouseLeave() {
    setHoveredTimestampMs(null);
    setHoveredIndex(null);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {hasStepBand && stepBandHeight > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: stepBandTop + 4,
            zIndex: 12,
            display: 'inline-flex',
            alignItems: 'flex-start',
            pointerEvents: 'none',
          }}
        >
          <span className="ui_chart_axis_unit" style={{ color: 'var(--text-soft)', lineHeight: 1, whiteSpace: 'nowrap' }}>
            Steps
          </span>
          <div style={{ pointerEvents: 'auto' }}>
            <HoverPanel
              title="Steps"
              body="The steps data comes from my phone. Each bar shows a 5 minute bucket with the number of steps recorded during that 5 minute window."
              sourceValue="Apple HealthKit"
              twStyles="-ml-0.5 -mt-2"
            />
          </div>
        </div>
      ) : null}
      {hasStepBand && stepBandHeight > 0
        ? visibleStepDayLabels.map((label) => {
            return (
              <div
                key={label.dayStartMs}
                style={{
                  position: 'absolute',
                  left: label.left,
                  top: stepBandTop + 6,
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              >
                <span
                  className="ui_chart_axis_unit"
                  style={{
                    color: stepTotalLabelColor,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label.text}
                </span>
              </div>
            );
          })
        : null}
      <div
        style={{
          position: 'absolute',
          left: 8,
          top: noteBandTop + 4,
          zIndex: 12,
          display: 'inline-flex',
          alignItems: 'flex-start',
          pointerEvents: 'none'
        }}
      >
        <span className="ui_chart_axis_unit" style={{ color: 'var(--text-soft)', lineHeight: 1, whiteSpace: 'nowrap' }}>
          Notes
        </span>
        <div style={{ pointerEvents: 'auto' }}>
          <HoverPanel
            title="Notes"
            body="Plain text timeline annotations. Hover the notes band to add a note. Click a note to inspect or edit it."
            sourceValue="Timeline notes"
            twStyles="-ml-0.5 -mt-2"
          />
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height,
          cursor: isDragging
            ? 'grabbing'
            : editable && hoveredPoint?.readingId && selectedReadingIdSet.has(hoveredPoint.readingId)
              ? 'ns-resize'
              : editable && hoveredPoint?.readingId
                ? 'pointer'
                : 'grab',
          touchAction: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <div
        aria-label="Notes band"
        onMouseMove={handleNoteBandMouseMove}
        onMouseLeave={handleNoteBandMouseLeave}
        style={{
          position: 'absolute',
          left: PADDING.left,
          right: PADDING.right,
          top: noteBandTop,
          height: noteBandHeight,
          borderRadius: 12,
          background: isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(100, 116, 139, 0.08)',
          border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(100, 116, 139, 0.18)'}`,
          overflow: 'hidden',
          zIndex: 6
        }}
      >
        {assignedNoteItems.map((note) => {
          const startX = getXForTimestamp(new Date(note.startAt).getTime());
          const endX = getXForTimestamp(new Date(note.endAt).getTime());
          const left = Math.max(0, startX - PADDING.left);
          const right = Math.max(left + 12, endX - PADDING.left);
          const width = Math.max(12, right - left);
          const top = NOTE_BAND_PADDING_Y + note.lane * (NOTE_ROW_HEIGHT + NOTE_ROW_GAP);
          const isSelected = selectedNoteId === note.id;

          return (
            <button
              key={note.id}
              type="button"
              onClick={() => onNoteSelect?.(note)}
              style={{
                position: 'absolute',
                left,
                top,
                width,
                height: NOTE_ROW_HEIGHT,
                borderRadius: 8,
                border: isSelected
                  ? `1px solid ${isDark ? 'rgba(226, 232, 240, 0.75)' : 'rgba(51, 65, 85, 0.65)'}`
                  : `1px solid ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.25)'}`,
                background: isSelected
                  ? (isDark ? 'rgba(148, 163, 184, 0.34)' : 'rgba(148, 163, 184, 0.42)')
                  : (isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.24)'),
                color: 'var(--text)',
                padding: '0 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                overflow: 'hidden',
                cursor: 'pointer'
              }}
            >
              <span
                className="ui_caption"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                  flex: 1
                }}
              >
                {note.text}
              </span>
            </button>
          );
        })}
        {hoveredTimestampMs !== null ? (
          <button
            type="button"
            aria-label="Add note"
            onClick={() => onNoteAddRequest?.(new Date(hoveredTimestampMs).toISOString())}
            style={{
              position: 'absolute',
              left: clamp(getXForTimestamp(hoveredTimestampMs) - PADDING.left - 12, 0, Math.max(0, chartWidth - 24)),
              top: noteBandHeight - NOTE_BAND_PADDING_Y - NOTE_ROW_HEIGHT,
              width: 24,
              height: 24,
              borderRadius: 999,
              border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.42)' : 'rgba(100, 116, 139, 0.35)'}`,
              background: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.18)',
              color: 'var(--text-soft)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            +
          </button>
        ) : null}
      </div>
      {(hoveredPoint || hoveredNotes.length > 0) && (
        <div
          className="rounded border border-border-strong bg-surface-strong"
          style={{
            position: 'absolute',
            left: Math.min(hoverPos.x + 12, containerWidth - 180),
            top: Math.max(8, hoverPos.y - 82),
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            pointerEvents: 'none',
            backdropFilter: 'blur(12px)',
            zIndex: 10,
            minWidth: 140
          }}
        >
          {hoveredPoint ? (
            <p className="ui_mono_value_lg" style={{ margin: 0, color: getRenderedReadingColor(hoveredPoint, colorMode, isDark) }}>
              {hoveredPoint.valueMmolL.toFixed(1)} <span className="ui_caption text-text-soft">mmol/L</span>
            </p>
          ) : null}
          {hoveredPoint && (!isEditDragging || hoveredPoint.readingId !== draggedReadingId) ? (
            <>
              <p className="ui_caption text-text-dim" style={{ margin: '4px 0 0' }}>
                {new Date(hoveredPoint.timestamp).toLocaleString([], {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
              <p className="ui_micro_label text-text-soft" style={{ margin: '2px 0 0' }}>
                {hoveredPoint.source}
              </p>
              {hoveredPoint.isCorrected && hoveredPoint.originalValueMmolL != null ? (
                <>
                  <p className="ui_caption text-text-dim" style={{ margin: '2px 0 0' }}>
                    corrected from {hoveredPoint.originalValueMmolL.toFixed(1)} mmol/L
                  </p>
                  {hoveredPoint.correctionReason ? (
                    <p className="ui_caption text-text-dim" style={{ margin: '2px 0 0' }}>
                      reason: {hoveredPoint.correctionReason}
                    </p>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
          {!isEditDragging && hoveredBasalPoint ? (
            <div className="mt-2 border-t border-border pt-2">
              <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                Basal
              </p>
              <p className="ui_mono_value_md" style={{ margin: '3px 0 0', color: 'rgba(186, 230, 253, 0.96)' }}>
                {hoveredBasalPoint.basalRateUnitsPerHour.toFixed(1)}{' '}
                <span className="ui_caption text-text-soft">U/hr</span>
              </p>
              <p className="ui_caption text-text-dim" style={{ margin: '2px 0 0' }}>
                {hoveredBasalPoint.eventName}
              </p>
            </div>
          ) : null}
          {!isEditDragging && hoveredStepBucket ? (
            <div className="mt-2 border-t border-border pt-2">
              <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                Steps
              </p>
              <p className="ui_mono_value_md" style={{ margin: '3px 0 0', color: 'rgba(253, 224, 71, 0.96)' }}>
                {hoveredStepBucket.stepCount.toLocaleString()}
              </p>
              <p className="ui_caption text-text-dim" style={{ margin: '2px 0 0' }}>
                {new Date(hoveredStepBucket.bucketStart).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}{' '}
                to{' '}
                {new Date(hoveredStepBucket.bucketEnd).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          ) : null}
          {hoveredEventItems.length > 0 && (
            <div className="mt-2 border-t border-border pt-2">
              <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                Tandem events
              </p>
              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                {hoveredEventItems.slice(0, 4).map((event) => {
                  const visual = getTandemEventVisual(event.eventName, isDark);
                  const summary = formatTandemEventSummary(event);
                  return (
                    <div
                      key={`${event.timestamp}:${event.eventName}`}
                      style={{ display: 'grid', gap: 2 }}
                    >
                      <p className="body_text text-text" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: visual.shape === 'diamond' ? 2 : 999,
                            background: visual.fill,
                            border: `1px solid ${visual.stroke}`,
                            display: 'inline-block'
                          }}
                        />
                        <span>{visual.label}</span>
                        {summary && (
                          <span className="ui_mono_text text-text-soft">
                            {summary}
                          </span>
                        )}
                      </p>
                      <p className="ui_caption text-text-dim" style={{ margin: 0 }}>
                        {new Date(event.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {hoveredIobValue !== null && (
            <div className="mt-2 border-t border-border pt-2">
              <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                IOB
              </p>
              <p className="ui_mono_value_md" style={{ margin: '3px 0 0', color: isDark ? 'rgba(167, 139, 250, 0.9)' : 'rgba(109, 40, 217, 0.85)' }}>
                {hoveredIobValue.toFixed(2)}{' '}
                <span className="ui_caption text-text-soft">U</span>
              </p>
            </div>
          )}
          {hoveredSuspendInterval && (
            <div className="mt-2 border-t border-border pt-2">
              <p className="ui_micro_label" style={{ margin: 0, color: isDark ? 'rgba(251, 113, 133, 0.9)' : 'rgba(190, 18, 60, 0.85)' }}>
                Suspended
              </p>
              <p className="ui_caption text-text-dim" style={{ margin: '4px 0 0' }}>
                {new Date(hoveredSuspendInterval.suspendMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' → '}
                {hoveredSuspendInterval.resumeMs
                  ? new Date(hoveredSuspendInterval.resumeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'ongoing'}
              </p>
            </div>
          )}
          {hoveredNotes.length > 0 && (
            <div className="mt-2 border-t border-border pt-2">
              <p className="ui_micro_label text-text-soft" style={{ margin: 0 }}>
                Notes
              </p>
              <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                {hoveredNotes.map((note) => (
                  <div key={note.id} style={{ display: 'grid', gap: 3 }}>
                    <p className="ui_caption text-text-soft" style={{ margin: 0 }}>
                      {note.allDay
                        ? `${new Date(note.startAt).toLocaleDateString()} to ${new Date(note.endAt).toLocaleDateString()}`
                        : `${new Date(note.startAt).toLocaleString()} to ${new Date(note.endAt).toLocaleString()}`}
                    </p>
                    <p
                      className="body_text text-text"
                      style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {note.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
