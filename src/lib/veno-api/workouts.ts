import {
  type Workout,
  type WorkoutDeleteResponse,
  type WorkoutMutationResponse,
  type WorkoutWritePayload
} from '@/lib/veno-api/types';
import { getAdminApiToken, getApiBaseUrl } from '@/lib/veno-api/env';

function resolveUrl(path: string): string {
  return new URL(path, getApiBaseUrl()).toString();
}

export async function createManualWorkout(
  payload: WorkoutWritePayload,
  actorId: string
): Promise<Workout> {
  const response = await fetch(resolveUrl('/api/admin/health/workouts'), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getAdminApiToken()}`,
      'Content-Type': 'application/json',
      'x-pulse-actor-id': actorId
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Workout create failed with status ${response.status}`);
  }

  const json = await response.json() as WorkoutMutationResponse;
  return json.workout;
}

export async function updateManualWorkout(
  workoutId: string,
  payload: WorkoutWritePayload,
  actorId: string
): Promise<Workout> {
  const response = await fetch(resolveUrl(`/api/admin/health/workouts/${workoutId}`), {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getAdminApiToken()}`,
      'Content-Type': 'application/json',
      'x-pulse-actor-id': actorId
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Workout update failed with status ${response.status}`);
  }

  const json = await response.json() as WorkoutMutationResponse;
  return json.workout;
}

export async function deleteManualWorkout(
  workoutId: string,
  actorId: string
): Promise<WorkoutDeleteResponse> {
  const response = await fetch(resolveUrl(`/api/admin/health/workouts/${workoutId}`), {
    method: 'DELETE',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getAdminApiToken()}`,
      'x-pulse-actor-id': actorId
    }
  });

  if (!response.ok) {
    throw new Error(`Workout delete failed with status ${response.status}`);
  }

  return response.json() as Promise<WorkoutDeleteResponse>;
}
