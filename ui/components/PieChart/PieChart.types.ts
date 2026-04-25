import type { ReactNode } from 'react';

export interface PieChartSlice {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface PieChartProps {
  data: PieChartSlice[];
  ariaLabel: string;
  size?: number;
  variant?: 'pie' | 'donut';
  innerRadius?: number;
  showLegend?: boolean;
  centerValue?: ReactNode;
  centerLabel?: ReactNode;
  emptyLabel?: string;
  animateOnChange?: boolean;
  formatValue?: (slice: PieChartSlice, total: number) => string;
  activeSliceId?: string | null;
  onSliceHover?: (slice: PieChartSlice | null) => void;
  onSliceClick?: (slice: PieChartSlice) => void;
}
