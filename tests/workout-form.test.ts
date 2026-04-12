import { describe, expect, test } from 'vitest';
import {
  createWorkoutDraft,
  validateWorkoutDraft
} from '@/lib/glucose/workout-form';

describe('workout form helpers', () => {
  test('creates manual workout drafts with 60 minute duration and 5 minute snapping', () => {
    const draft = createWorkoutDraft('UTC', '2026-04-09T08:03:00.000Z');

    expect(draft.startDate).toBe('2026-04-09');
    expect(draft.startTime).toBe('08:05');
    expect(draft.endDate).toBe('2026-04-09');
    expect(draft.endTime).toBe('09:05');
  });

  test('validates normalized workout type and optional display label', () => {
    const draft = {
      ...createWorkoutDraft('UTC', '2026-04-09T08:03:00.000Z'),
      workoutType: 'strength' as const,
      displayName: 'Gym'
    };

    const result = validateWorkoutDraft(draft, null);

    expect(result.error).toBeNull();
    expect(result.payload).toEqual({
      startAt: '2026-04-09T08:05:00.000Z',
      endAt: '2026-04-09T09:05:00.000Z',
      workoutType: 'strength',
      displayName: 'Gym'
    });
  });
});
