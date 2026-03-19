export interface ChartPoint {
  timestamp: string;
  valueMmolL: number;
  source: 'official' | 'share';
}

export interface BasalChartPoint {
  timestamp: string;
  basalRateUnitsPerHour: number;
  eventName: string;
  localTimestamp: string;
  pumpTimeZone: string;
}

export interface TandemEventChartPoint {
  timestamp: string;
  eventName: string;
  localTimestamp: string;
  pumpTimeZone: string;
  insulinDelivered: number | null;
  insulinRequested: number | null;
  iob: number | null;
  carbsGrams: number | null;
  glucoseMmolL: number | null;
}

export interface LatestReading {
  valueMmolL: number;
  valueMgDl: number;
  trend: string;
  timestamp: string;
  source: 'official' | 'share';
}

export interface GlucoseApiResponse {
  items: ChartPoint[];
  basalItems: BasalChartPoint[];
  eventItems: TandemEventChartPoint[];
  latest: LatestReading | null;
  meta: {
    from: string;
    to: string;
    officialCount: number;
    shareCount: number;
    mergedCount: number;
    tandemBasalCount: number;
    tandemEventCount: number;
  };
  error?: { message: string };
}

export interface GlucoseUpdatesResponse {
  latest: LatestReading | null;
  meta: {
    since: string;
    to: string;
    newCount: number;
  };
  error?: { message: string };
}
