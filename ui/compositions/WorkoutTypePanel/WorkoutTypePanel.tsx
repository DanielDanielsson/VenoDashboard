'use client';

import { useMemo, type ReactElement } from 'react';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { PieChart } from '@ui/components/PieChart';
import type { WorkoutChartPoint } from '@/lib/glucose/types';
import { buildWorkoutTypePieSlices } from './workoutTypeChart';

interface WorkoutTypePanelProps {
  workouts: WorkoutChartPoint[];
  loading?: boolean;
}

export const WorkoutTypePanel = ({
  workouts,
  loading = false,
}: WorkoutTypePanelProps): ReactElement => {
  const slices = useMemo(() => buildWorkoutTypePieSlices(workouts), [workouts]);
  const totalWorkouts = workouts.length;

  return (
    <DashboardPanel title="Workout Types">
      {totalWorkouts === 0 && !loading ? (
        <div className="grid min-h-[220px] place-items-center">
          <p className="ui_helper_text text-text-soft">No workouts in the selected range.</p>
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.45 : 1, transition: 'opacity 200ms ease' }}>
          <PieChart
            ariaLabel="Workout type distribution"
            data={slices}
            centerValue={String(totalWorkouts)}
            centerLabel={totalWorkouts === 1 ? 'session' : 'sessions'}
            formatValue={(slice, total) => {
              const share = total > 0 ? Math.round((slice.value / total) * 100) : 0;
              return `${slice.value} · ${share}%`;
            }}
          />
        </div>
      )}
    </DashboardPanel>
  );
};
