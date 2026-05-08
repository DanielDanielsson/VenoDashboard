import type { ReactNode } from 'react';
import { createPanelRegistry } from '@/lib/dashboard/panel-registry';
import { TextPanel } from '@ui/compositions/TextPanel';

export interface TimeRangeDashboardContext {
  renderAverageGlucosePanel: () => ReactNode;
  renderTimeInRangePanel: () => ReactNode;
  renderWorkoutTypesPanel: () => ReactNode;
  renderGlucoseTimelinePanel: () => ReactNode;
  renderAgpPanel: () => ReactNode;
}

export const timeRangeDashboardRegistry = createPanelRegistry<TimeRangeDashboardContext>([
  {
    group: 'veno.average-glucose',
    render: ({ context }) => context.renderAverageGlucosePanel(),
  },
  {
    group: 'veno.time-in-range',
    render: ({ context }) => context.renderTimeInRangePanel(),
  },
  {
    group: 'veno.workout-types',
    render: ({ context }) => context.renderWorkoutTypesPanel(),
  },
  {
    group: 'veno.glucose-timeline',
    render: ({ context }) => context.renderGlucoseTimelinePanel(),
  },
  {
    group: 'veno.glucose-agp',
    render: ({ context }) => context.renderAgpPanel(),
  },
  {
    group: 'veno.text',
    render: ({ panelId, panel }) => <TextPanel panelId={panelId} title={panel.spec.title} />,
  },
]);
