'use client';

import './histogramChart.css';
import type { ReactElement } from 'react';
import type { HistogramChartProps, HistogramChartTick } from './HistogramChart.types';

const VIEWBOX_WIDTH = 480;
const DEFAULT_HEIGHT = 240;
const PADDING = { top: 20, right: 20, bottom: 42, left: 44 };
const HISTOGRAM_PALETTE = [
  'var(--color-histogram-chart-bar)',
  'var(--color-histogram-chart-bar-alt)',
] as const;

const buildTicks = (maxValue: number): HistogramChartTick[] => {
  if (maxValue <= 0) {
    return [{ value: 0, label: '0' }];
  }

  return Array.from({ length: 5 }, (_, index) => {
    const value = (maxValue * index) / 4;
    return {
      value,
      label: Number.isInteger(value) ? String(value) : value.toFixed(1),
    };
  });
};

export const HistogramChart = ({
  data,
  ariaLabel,
  height = DEFAULT_HEIGHT,
  yTicks,
}: HistogramChartProps): ReactElement => {
  const chartWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;
  const maxValue = data.length ? Math.max(...data.map((bin) => Math.max(0, bin.value))) : 0;
  const resolvedYTicks = yTicks ?? buildTicks(maxValue);
  const barWidth = data.length > 0 ? chartWidth / data.length : chartWidth;

  function yForValue(value: number): number {
    if (maxValue <= 0) {
      return PADDING.top + chartHeight;
    }

    return PADDING.top + chartHeight * (1 - value / maxValue);
  }

  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`} className="block h-auto w-full">
      {resolvedYTicks.map((tick) => (
        <g key={`y-${tick.value}`}>
          <line
            x1={PADDING.left}
            x2={PADDING.left + chartWidth}
            y1={yForValue(tick.value)}
            y2={yForValue(tick.value)}
            className="stroke-histogram-chart-grid"
          />
          <text
            x={PADDING.left - 10}
            y={yForValue(tick.value)}
            textAnchor="end"
            dominantBaseline="middle"
            className="ui_chart_axis_text fill-histogram-chart-axis"
          >
            {tick.label}
          </text>
        </g>
      ))}
      {data.map((bin, index) => {
        const x = PADDING.left + index * barWidth + 8;
        const width = Math.max(12, barWidth - 16);
        const y = yForValue(Math.max(0, bin.value));
        const resolvedColor = bin.color ?? HISTOGRAM_PALETTE[index % HISTOGRAM_PALETTE.length];

        return (
          <g key={bin.id}>
            <rect
              x={x}
              y={y}
              width={width}
              height={Math.max(0, PADDING.top + chartHeight - y)}
              rx={6}
              fill={resolvedColor}
              aria-label={`${bin.label}: ${bin.value}`}
            />
            <text
              x={x + width / 2}
              y={height - 10}
              textAnchor="middle"
              className="ui_chart_axis_text fill-histogram-chart-axis"
            >
              {bin.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
