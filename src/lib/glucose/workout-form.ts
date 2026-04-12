import type { WorkoutChartPoint } from './types';
import {
  buildUtcFromDraft,
  getLocalDateString,
  getLocalTimeString
} from './timeline-note-form';

export const NORMALIZED_WORKOUT_TYPES = [
  'run',
  'walk',
  'cycle',
  'strength',
  'hiit',
  'yoga',
  'swim',
  'hike',
  'other'
] as const;

export type NormalizedWorkoutType = (typeof NORMALIZED_WORKOUT_TYPES)[number];

export interface WorkoutDraft {
  timezone: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  workoutType: NormalizedWorkoutType;
  displayName: string;
}

export interface WorkoutValidationResult {
  payload: {
    startAt: string;
    endAt: string;
    workoutType: NormalizedWorkoutType;
    displayName: string | null;
  } | null;
  preview: WorkoutChartPoint | null;
  error: string | null;
}

const DEFAULT_WORKOUT_DURATION_MINUTES = 60;
const WORKOUT_SNAP_MINUTES = 5;

function snapIsoToFiveMinuteBoundary(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const localDate = getLocalDateString(date.toISOString(), timeZone);
  const localTime = getLocalTimeString(date.toISOString(), timeZone);
  const [hour, minute] = localTime.split(':').map(Number);
  const snappedTotalMinutes = Math.round(((hour * 60) + minute) / WORKOUT_SNAP_MINUTES) * WORKOUT_SNAP_MINUTES;
  const snappedHour = Math.floor(snappedTotalMinutes / 60) % 24;
  const snappedMinute = snappedTotalMinutes % 60;
  const dayOffset = Math.floor(snappedTotalMinutes / (24 * 60));
  const snappedDate = new Date(`${localDate}T00:00:00.000Z`);
  snappedDate.setUTCDate(snappedDate.getUTCDate() + dayOffset);

  return buildUtcFromDraft(
    snappedDate.toISOString().slice(0, 10),
    `${String(snappedHour).padStart(2, '0')}:${String(snappedMinute).padStart(2, '0')}`,
    timeZone
  );
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function isNormalizedWorkoutType(value: string): value is NormalizedWorkoutType {
  return NORMALIZED_WORKOUT_TYPES.includes(value as NormalizedWorkoutType);
}

export function createWorkoutDraft(timezone: string, hoveredAt: string | null): WorkoutDraft {
  const snappedStartAt = snapIsoToFiveMinuteBoundary(hoveredAt ?? new Date().toISOString(), timezone);
  const endAt = addMinutes(snappedStartAt, DEFAULT_WORKOUT_DURATION_MINUTES);

  return {
    timezone,
    startDate: getLocalDateString(snappedStartAt, timezone),
    startTime: getLocalTimeString(snappedStartAt, timezone),
    endDate: getLocalDateString(endAt, timezone),
    endTime: getLocalTimeString(endAt, timezone),
    workoutType: 'other',
    displayName: ''
  };
}

export function draftFromWorkout(workout: WorkoutChartPoint, timezone: string): WorkoutDraft {
  return {
    timezone,
    startDate: getLocalDateString(workout.startAt, timezone),
    startTime: getLocalTimeString(workout.startAt, timezone),
    endDate: getLocalDateString(workout.endAt, timezone),
    endTime: getLocalTimeString(workout.endAt, timezone),
    workoutType: isNormalizedWorkoutType(workout.workoutType) ? workout.workoutType : 'other',
    displayName: workout.displayName ?? ''
  };
}

export function validateWorkoutDraft(
  draft: WorkoutDraft,
  existing: WorkoutChartPoint | null
): WorkoutValidationResult {
  if (!isNormalizedWorkoutType(draft.workoutType)) {
    return { payload: null, preview: null, error: 'Choose a workout type.' };
  }

  if (!draft.startDate || !draft.startTime || !draft.endDate || !draft.endTime) {
    return { payload: null, preview: null, error: 'Workout start and end time are required.' };
  }

  const startAt = buildUtcFromDraft(draft.startDate, draft.startTime, draft.timezone);
  const endAt = buildUtcFromDraft(draft.endDate, draft.endTime, draft.timezone);

  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return { payload: null, preview: null, error: 'End time must be after start time.' };
  }

  const displayName = draft.displayName.trim() || null;

  return {
    payload: {
      startAt,
      endAt,
      workoutType: draft.workoutType,
      displayName
    },
    preview: {
      id: existing?.id ?? 'draft-workout',
      startAt,
      endAt,
      workoutType: draft.workoutType,
      rawWorkoutType: existing?.rawWorkoutType ?? null,
      displayName,
      sourceSystem: existing?.sourceSystem ?? 'manual',
      sourceId: existing?.sourceId ?? null
    },
    error: null
  };
}
