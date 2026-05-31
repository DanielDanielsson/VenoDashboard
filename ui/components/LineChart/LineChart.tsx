'use client';

import './lineChart.css';
import type { ReactElement } from 'react';
import type { LineChartProps, LineChartTick } from './LineChart.types';

const VIEWBOX_WIDTH = 480;
const DEFAULT_HEIGHT = 240;
const PADDING = { top: 20, right: 20, bottom: 36, left: 44 };

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const buildTicks = (values: number[], fallbackCount: number): LineChartTick[] => {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ value: min, label: String(min) }];
  }

  return Array.from({ length: fallbackCount }, (_, index) => {
    const value = min + ((max - min) * index) / (fallbackCount - 1);
    return {
      value,
      label: Number.isInteger(value) ? String(value) : value.toFixed(1),
    };
  });
};

export const LineChart = ({
  data,
  ariaLabel,
  height = DEFAULT_HEIGHT,
  xTicks,
  yTicks,
  yDomain,
  showArea = true,
}: LineChartProps): ReactElement => {
  const chartWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;
  const xValues = data.map((point) => point.x);
  const yValues = data.map((point) => point.y);
  const minX = xValues.length ? Math.min(...xValues) : 0;
  const maxX = xValues.length ? Math.max(...xValues) : 1;
  const [minY, maxY] = yDomain ?? (yValues.length ? [Math.min(...yValues), Math.max(...yValues)] : [0, 1]);
  const resolvedXTicks = xTicks ?? buildTicks(xValues, 4);
  const resolvedYTicks = yTicks ?? buildTicks(yValues, 5);

  function xForValue(value: number): number {
    if (maxX === minX) {
      return PADDING.left + chartWidth / 2;
    }

    return PADDING.left + ((value - minX) / (maxX - minX)) * chartWidth;
  }

  function yForValue(value: number): number {
    if (maxY === minY) {
      return PADDING.top + chartHeight / 2;
    }

    const normalized = clamp((value - minY) / (maxY - minY), 0, 1);
    return PADDING.top + chartHeight * (1 - normalized);
  }

  const linePath = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xForValue(point.x).toFixed(3)} ${yForValue(point.y).toFixed(3)}`)
    .join(' ');

  const areaPath = data.length
    ? `${linePath} L ${xForValue(data[data.length - 1]!.x).toFixed(3)} ${(PADDING.top + chartHeight).toFixed(3)} L ${xForValue(data[0]!.x).toFixed(3)} ${(PADDING.top + chartHeight).toFixed(3)} Z`
    : '';

  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`} className="block h-auto w-full">
      {resolvedYTicks.map((tick) => (
        <g key={`y-${tick.value}`}>
          <line
            x1={PADDING.left}
            x2={PADDING.left + chartWidth}
            y1={yForValue(tick.value)}
            y2={yForValue(tick.value)}
            className="stroke-line-chart-grid"
          />
          <text
            x={PADDING.left - 10}
            y={yForValue(tick.value)}
            textAnchor="end"
            dominantBaseline="middle"
            className="ui_chart_axis_text fill-line-chart-axis"
          >
            {tick.label}
          </text>
        </g>
      ))}
      {resolvedXTicks.map((tick) => (
        <text
          key={`x-${tick.value}`}
          x={xForValue(tick.value)}
          y={height - 10}
          textAnchor="middle"
          className="ui_chart_axis_text fill-line-chart-axis"
        >
          {tick.label}
        </text>
      ))}
      {showArea && areaPath ? <path d={areaPath} className="fill-line-chart-area" /> : null}
      {linePath ? <path d={linePath} className="fill-none stroke-line-chart-series" strokeWidth={2.5} /> : null}
      {data.map((point) => (
        <circle
          key={point.id}
          cx={xForValue(point.x)}
          cy={yForValue(point.y)}
          r={3}
          className="fill-line-chart-series"
        />
      ))}
    </svg>
  );
};
