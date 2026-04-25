export interface LineChartPoint {
  id: string;
  x: number;
  y: number;
}

export interface LineChartTick {
  value: number;
  label: string;
}

export interface LineChartProps {
  data: LineChartPoint[];
  ariaLabel: string;
  height?: number;
  xTicks?: LineChartTick[];
  yTicks?: LineChartTick[];
  yDomain?: [number, number];
  showArea?: boolean;
}
