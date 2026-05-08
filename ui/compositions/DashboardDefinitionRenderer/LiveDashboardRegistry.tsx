import { createPanelRegistry } from '@/lib/dashboard/panel-registry';
import type { ConnectionMapSnapshot } from '@/lib/dashboard/connection-map';
import { ConnectionsMapPanel } from '@ui/compositions/ConnectionsMapPanel';
import { LiveGlucosePanel } from '@ui/compositions/LiveGlucosePanel';
import { SharedTimersPanel } from '@ui/compositions/SharedTimersPanel/SharedTimersPanel';
import { TextPanel } from '@ui/compositions/TextPanel';
import { TimeInRangePanel } from '@ui/compositions/TimeInRangePanel';

export interface LiveDashboardContext {
  isOwner: boolean;
  latestReadingTimestamp?: string;
  initialConnectionSnapshot: ConnectionMapSnapshot | null;
}

export const liveDashboardRegistry = createPanelRegistry<LiveDashboardContext>([
  {
    group: 'veno.live-glucose',
    render: ({ context }) => (
      <LiveGlucosePanel
        enableStream={context.isOwner}
        latestReadingTimestamp={context.latestReadingTimestamp}
      />
    ),
  },
  {
    group: 'veno.shared-timers',
    render: ({ context }) => <SharedTimersPanel readOnly={!context.isOwner} />,
  },
  {
    group: 'veno.time-in-range',
    render: () => <TimeInRangePanel defaultLayout="overview" />,
  },
  {
    group: 'veno.connections-map',
    render: ({ context }) =>
      context.initialConnectionSnapshot ? (
        <ConnectionsMapPanel initialSnapshot={context.initialConnectionSnapshot} />
      ) : null,
  },
  {
    group: 'veno.text',
    render: ({ panelId, panel }) => <TextPanel panelId={panelId} title={panel.spec.title} />,
  },
]);
