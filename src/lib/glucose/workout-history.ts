import type { GlucoseApiResponse, WorkoutChartPoint } from './types';

function workoutOverlapsHistoryWindow(
  workout: WorkoutChartPoint,
  response: Pick<GlucoseApiResponse, 'meta'>
): boolean {
  const startMs = new Date(workout.startAt).getTime();
  const endMs = new Date(workout.endAt).getTime();
  const fromMs = new Date(response.meta.from).getTime();
  const toMs = new Date(response.meta.to).getTime();

  return startMs < toMs && endMs > fromMs;
}

function sortWorkouts(workouts: WorkoutChartPoint[]): WorkoutChartPoint[] {
  return [...workouts].sort((left, right) => {
    const startDelta = new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    if (startDelta !== 0) {
      return startDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

export function upsertWorkoutInHistoryResponse(
  response: GlucoseApiResponse,
  workout: WorkoutChartPoint
): GlucoseApiResponse {
  const existingWorkouts = (response.workoutItems ?? []).filter((item) => item.id !== workout.id);
  const nextWorkouts = workoutOverlapsHistoryWindow(workout, response)
    ? sortWorkouts([...existingWorkouts, workout])
    : sortWorkouts(existingWorkouts);

  return {
    ...response,
    workoutItems: nextWorkouts
  };
}

export function removeWorkoutFromHistoryResponse(
  response: GlucoseApiResponse,
  workoutId: string
): GlucoseApiResponse {
  return {
    ...response,
    workoutItems: (response.workoutItems ?? []).filter((item) => item.id !== workoutId)
  };
}
