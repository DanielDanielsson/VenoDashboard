// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { WorkoutTypePanel } from './WorkoutTypePanel';

describe('WorkoutTypePanel', () => {
  test('aggregates workouts into reusable pie chart slices', () => {
    render(
      <WorkoutTypePanel
        workouts={[
          {
            id: 'w1',
            startAt: '2026-04-01T08:00:00.000Z',
            endAt: '2026-04-01T09:00:00.000Z',
            workoutType: 'strength',
            rawWorkoutType: 'strengthTraining',
            displayName: 'Upper body',
            sourceSystem: 'apple_health',
            sourceId: 'apple-1',
          },
          {
            id: 'w2',
            startAt: '2026-04-02T08:00:00.000Z',
            endAt: '2026-04-02T09:00:00.000Z',
            workoutType: 'walk',
            rawWorkoutType: 'walking',
            displayName: null,
            sourceSystem: 'apple_health',
            sourceId: 'apple-2',
          },
          {
            id: 'w3',
            startAt: '2026-04-03T08:00:00.000Z',
            endAt: '2026-04-03T09:00:00.000Z',
            workoutType: 'strength',
            rawWorkoutType: 'strengthTraining',
            displayName: null,
            sourceSystem: 'manual',
            sourceId: 'manual-3',
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Workout Types' })).toBeInTheDocument();
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('2 · 67%')).toBeInTheDocument();
    expect(screen.getByText('Walk')).toBeInTheDocument();
    expect(screen.getByText('1 · 33%')).toBeInTheDocument();
  });

  test('shows an empty state when no workouts are available', () => {
    render(<WorkoutTypePanel workouts={[]} />);

    expect(screen.getByText('No workouts in the selected range.')).toBeInTheDocument();
  });
});
