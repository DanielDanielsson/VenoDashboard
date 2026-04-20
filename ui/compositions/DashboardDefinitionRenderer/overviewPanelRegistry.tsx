import { createPanelRegistry } from '@/lib/dashboard/panel-registry';
import type { ConnectionMapSnapshot } from '@/lib/dashboard/connection-map';
import { ConnectionsMapPanel } from '@ui/compositions/ConnectionsMapPanel';
import { LiveGlucosePanel } from '@ui/compositions/LiveGlucosePanel';
import { SharedTimersPanel } from '@ui/compositions/SharedTimersPanel/SharedTimersPanel';
import { TimeInRangePanel } from '@ui/compositions/TimeInRangePanel';

export interface OverviewDashboardContext {
  isOwner: boolean;
  latestReadingTimestamp?: string;
  initialConnectionSnapshot: ConnectionMapSnapshot | null;
}

export const overviewPanelRegistry = createPanelRegistry<OverviewDashboardContext>([
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
]);
