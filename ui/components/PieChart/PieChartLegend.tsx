'use client';

import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { PieChartSlice } from './PieChart.types';

interface PieChartLegendProps {
  data: PieChartSlice[];
  total: number;
  activeSliceId?: string | null;
  formatValue: (slice: PieChartSlice, total: number) => string;
  onSliceHover?: (slice: PieChartSlice | null) => void;
  onSliceClick?: (slice: PieChartSlice) => void;
}

export function PieChartLegend({
  data,
  total,
  activeSliceId = null,
  formatValue,
  onSliceHover,
  onSliceClick,
}: PieChartLegendProps): ReactElement {
  const isInteractive = Boolean(onSliceHover || onSliceClick);

  return (
    <ul className="grid gap-3" aria-label="Pie chart legend">
      {data.map((slice) => {
        const content = (
          <span
            className="flex items-center justify-between gap-4"
            style={{
              opacity: activeSliceId && activeSliceId !== slice.id ? 0.55 : 1,
              transition: 'opacity 160ms ease',
            }}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className="block size-2.5 shrink-0 rounded-[3px]"
                aria-hidden="true"
                style={{ backgroundColor: slice.color }}
              />
              <span className="ui_micro_label truncate text-pie-chart-legend-label">
                {slice.label}
              </span>
            </span>
            <span className="ui_mono_value_md text-pie-chart-legend-value">
              {formatValue(slice, total)}
            </span>
          </span>
        );

        return (
          <li key={slice.id}>
            {isInteractive ? (
              <button
                type="button"
                className={twMerge(
                  'w-full rounded-md text-left outline-offset-2',
                  onSliceClick ? 'cursor-pointer' : 'cursor-default',
                )}
                onMouseEnter={() => onSliceHover?.(slice)}
                onMouseLeave={() => onSliceHover?.(null)}
                onFocus={() => onSliceHover?.(slice)}
                onBlur={() => onSliceHover?.(null)}
                onClick={() => onSliceClick?.(slice)}
                aria-label={`${slice.label}: ${formatValue(slice, total)}`}
              >
                {content}
              </button>
            ) : (
              <div>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
