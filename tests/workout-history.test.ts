import { describe, expect, test } from 'vitest';
import {
  removeWorkoutFromHistoryResponse,
  upsertWorkoutInHistoryResponse
} from '@/lib/glucose/workout-history';
import type { GlucoseApiResponse, WorkoutChartPoint } from '@/lib/glucose/types';

function createResponse(): GlucoseApiResponse {
  return {
    items: [],
    basalItems: [],
    eventItems: [],
    stepItems: [],
    workoutItems: [
      {
        id: 'workout-1',
        startAt: '2026-04-09T08:00:00.000Z',
        endAt: '2026-04-09T09:00:00.000Z',
        workoutType: 'run',
        rawWorkoutType: null,
        displayName: 'Run',
        sourceSystem: 'manual',
        sourceId: 'manual-workout-1'
      }
    ],
    noteItems: [],
    latest: null,
    meta: {
      from: '2026-04-09T00:00:00.000Z',
      to: '2026-04-10T00:00:00.000Z',
      officialCount: 0,
      shareCount: 0,
      mergedCount: 0,
      tandemBasalCount: 0,
      tandemEventCount: 0,
      healthStepCount: 0
    }
  };
}

describe('workout history helpers', () => {
  test('upserts a visible workout immediately', () => {
    const workout: WorkoutChartPoint = {
      id: 'workout-1',
      startAt: '2026-04-09T09:00:00.000Z',
      endAt: '2026-04-09T10:00:00.000Z',
      workoutType: 'strength',
      rawWorkoutType: null,
      displayName: 'Gym',
      sourceSystem: 'manual',
      sourceId: 'manual-workout-1'
    };

    const updated = upsertWorkoutInHistoryResponse(createResponse(), workout);

    expect(updated.workoutItems).toHaveLength(1);
    expect(updated.workoutItems?.[0]?.displayName).toBe('Gym');
  });

  test('removes a workout immediately', () => {
    const updated = removeWorkoutFromHistoryResponse(createResponse(), 'workout-1');

    expect(updated.workoutItems).toEqual([]);
  });
});
