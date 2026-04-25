export interface HistogramChartBin {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface HistogramChartTick {
  value: number;
  label: string;
}

export interface HistogramChartProps {
  data: HistogramChartBin[];
  ariaLabel: string;
  height?: number;
  yTicks?: HistogramChartTick[];
}
