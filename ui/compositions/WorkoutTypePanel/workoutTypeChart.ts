import type { PieChartSlice } from '@ui/components/PieChart';
import { getWorkoutTypeLabel } from '@/lib/glucose/workout-display';
import type { WorkoutChartPoint } from '@/lib/glucose/types';

export function buildWorkoutTypePieSlices(workouts: WorkoutChartPoint[]): PieChartSlice[] {
  const counts = new Map<string, number>();

  for (const workout of workouts) {
    const nextCount = (counts.get(workout.workoutType) ?? 0) + 1;
    counts.set(workout.workoutType, nextCount);
  }

  return [...counts.entries()]
    .map(([workoutType, count]) => ({
      id: workoutType,
      label: getWorkoutTypeLabel(workoutType),
      value: count,
    }))
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }

      return left.label.localeCompare(right.label);
    });
}
