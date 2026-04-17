import type { WorkoutChartPoint } from './types';
import type { IconName } from '@ui/base/Icon/Icon.types';

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  run: 'Run',
  walk: 'Walk',
  cycle: 'Cycle',
  strength: 'Strength',
  hiit: 'HIIT',
  yoga: 'Yoga',
  swim: 'Swim',
  hike: 'Hike',
  other: 'Workout'
};

const WORKOUT_TYPE_ICONS: Record<string, IconName> = {
  run: 'workout-run',
  walk: 'workout-walk',
  cycle: 'workout-cycle',
  strength: 'workout-strength',
  hiit: 'workout-hiit',
  yoga: 'workout-yoga',
  swim: 'workout-swim',
  hike: 'workout-hike',
  other: 'activity'
};

export function getWorkoutDisplayLabel(workout: Pick<WorkoutChartPoint, 'displayName' | 'workoutType'>): string {
  const customLabel = workout.displayName?.trim();
  if (customLabel) {
    return customLabel;
  }

  return WORKOUT_TYPE_LABELS[workout.workoutType] ?? 'Workout';
}

export function getWorkoutIconName(workoutType: string): IconName {
  return WORKOUT_TYPE_ICONS[workoutType] ?? 'activity';
}

export function getWorkoutSourceLabel(sourceSystem: string): string {
  switch (sourceSystem) {
    case 'apple_health':
      return 'Apple Health';
    case 'manual':
      return 'Manual entry';
    default:
      return sourceSystem;
  }
}

export function formatWorkoutTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);

  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatWorkoutDuration(startAt: string, endAt: string): string {
  const durationMs = Math.max(0, new Date(endAt).getTime() - new Date(startAt).getTime());
  const totalMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export function formatWorkoutMetrics(
  workout: Pick<WorkoutChartPoint, 'activeEnergyKilocalories' | 'distanceMeters'>
): string[] {
  const metrics: string[] = [];

  if (typeof workout.activeEnergyKilocalories === 'number' && Number.isFinite(workout.activeEnergyKilocalories)) {
    metrics.push(`${Math.round(workout.activeEnergyKilocalories)} kcal`);
  }

  if (typeof workout.distanceMeters === 'number' && Number.isFinite(workout.distanceMeters)) {
    const distanceKilometers = workout.distanceMeters / 1000;
    metrics.push(`${distanceKilometers.toFixed(distanceKilometers >= 10 ? 0 : 1)} km`);
  }

  return metrics;
}
