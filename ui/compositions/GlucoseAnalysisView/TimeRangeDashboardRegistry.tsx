import type { ReactNode } from 'react';
import { createPanelRegistry } from '@/lib/dashboard/panel-registry';
import { DexcomGlucoseReadingsPanel } from '@ui/compositions/DexcomGlucoseReadingsPanel';
import { TextPanel } from '@ui/compositions/TextPanel';
import type { GlucoseUnit } from '@/lib/glucose/units';

export interface TimeRangeDashboardContext {
  isOwner: boolean;
  refreshRevision: number;
  timeWindow: {
    from: string;
    to: string;
  } | null;
  timeWindowCacheKey?: string | null;
  globalGlucoseUnit: GlucoseUnit;
  renderAverageGlucosePanel: (panelId: string) => ReactNode;
  renderTimeInRangePanel: (panelId: string) => ReactNode;
  renderWorkoutTypesPanel: (panelId: string) => ReactNode;
  renderGlucoseTimelinePanel: (panelId: string) => ReactNode;
  renderAgpPanel: (panelId: string) => ReactNode;
}

export const timeRangeDashboardRegistry = createPanelRegistry<TimeRangeDashboardContext>([
  {
    group: 'veno.average-glucose',
    render: ({ context, panelId }) => context.renderAverageGlucosePanel(panelId),
  },
  {
    group: 'veno.time-in-range',
    render: ({ context, panelId }) => context.renderTimeInRangePanel(panelId),
  },
  {
    group: 'veno.workout-types',
    render: ({ context, panelId }) => context.renderWorkoutTypesPanel(panelId),
  },
  {
    group: 'veno.dexcom-glucose-readings',
    render: ({ context, panelId }) => (
      <DexcomGlucoseReadingsPanel
        panelId={panelId}
        isOwner={context.isOwner}
        refreshRevision={context.refreshRevision}
        timeWindow={context.timeWindow}
        timeWindowCacheKey={context.timeWindowCacheKey}
        globalGlucoseUnit={context.globalGlucoseUnit}
      />
    ),
  },
  {
    group: 'veno.glucose-timeline',
    render: ({ context, panelId }) => context.renderGlucoseTimelinePanel(panelId),
  },
  {
    group: 'veno.glucose-agp',
    render: ({ context, panelId }) => context.renderAgpPanel(panelId),
  },
  {
    group: 'veno.text',
    render: ({ panelId, panel }) => <TextPanel panelId={panelId} title={panel.spec.title} />,
  },
]);
