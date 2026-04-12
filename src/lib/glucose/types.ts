export interface ChartPoint {
  readingId?: string;
  timestamp: string;
  valueMmolL: number;
  valueMgDl?: number;
  trend?: string;
  source: 'official' | 'share';
  originalValueMmolL?: number | null;
  originalValueMgDl?: number | null;
  isCorrected?: boolean;
  correctionReason?: string | null;
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

export interface HealthStepChartPoint {
  bucketStart: string;
  bucketEnd: string;
  stepCount: number;
  source: string;
}

export interface WorkoutChartPoint {
  id: string;
  startAt: string;
  endAt: string;
  workoutType: string;
  rawWorkoutType: string | null;
  displayName: string | null;
  sourceSystem: string;
  sourceId: string | null;
  updatedAt?: string;
}

export interface TimelineNote {
  id: string;
  text: string;
  startAt: string;
  endAt: string;
  timezone: string;
  allDay: boolean;
  authorType: 'user' | 'assistant';
  source: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface LatestReading {
  id?: string;
  valueMmolL: number;
  valueMgDl: number;
  trend: string;
  timestamp: string;
  source: 'official' | 'share';
  originalValueMmolL?: number | null;
  originalValueMgDl?: number | null;
  isCorrected?: boolean;
  correctionReason?: string | null;
}

export interface GlucoseApiResponse {
  items: ChartPoint[];
  basalItems: BasalChartPoint[];
  eventItems: TandemEventChartPoint[];
  stepItems: HealthStepChartPoint[];
  workoutItems?: WorkoutChartPoint[];
  noteItems?: TimelineNote[];
  latest: LatestReading | null;
  meta: {
    from: string;
    to: string;
    officialCount: number;
    shareCount: number;
    mergedCount: number;
    tandemBasalCount: number;
    tandemEventCount: number;
    healthStepCount: number;
    timelineRevision?: string | null;
  };
  error?: { message: string };
}

export interface GlucoseUpdatesResponse {
  latest: LatestReading | null;
  meta: {
    since: string;
    to: string;
    newCount: number;
    newGlucoseCount?: number;
    newWorkoutMutationCount?: number;
    newTandemBasalCount?: number;
    newTandemEventCount?: number;
    newNoteMutationCount?: number;
    timelineRevision?: string | null;
  };
  error?: { message: string };
}
