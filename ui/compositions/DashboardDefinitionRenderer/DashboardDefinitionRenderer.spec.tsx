// @vitest-environment jsdom
import { render as rtlRender, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { createPanelRegistry } from '@/lib/dashboard/panel-registry';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { parseDashboardDefinition } from '@/lib/dashboard/schema';
import { DashboardDefinitionRenderer } from './DashboardDefinitionRenderer';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const render = (ui: React.ReactElement) => {
  return rtlRender(<NotificationsProvider>{ui}</NotificationsProvider>);
};

const createOverviewDashboardDefinition = () => {
  return parseDashboardDefinition({
    kind: 'Dashboard',
    spec: {
      uid: 'overview',
      title: 'Overview',
      timeSettings: {
        autoRefresh: '',
        autoRefreshIntervals: ['5s'],
      },
      elements: {
        'panel-current-glucose': panel(1, 'Current Glucose', 'veno.live-glucose'),
        'panel-timers': panel(2, 'Timers', 'veno.shared-timers'),
        'panel-connections': panel(3, 'Connections', 'veno.connections-map'),
      },
      layout: {
        kind: 'GridLayout',
        spec: {
          items: [
            layoutItem('panel-current-glucose', 0),
            layoutItem('panel-timers', 1),
            layoutItem('panel-connections', 2),
          ],
        },
      },
    },
  });
};

const panel = (id: number, title: string, group: string) => {
  return {
    kind: 'Panel',
    spec: {
      id,
      title,
      vizConfig: {
        kind: 'VizConfig',
        group,
        version: 'v1',
      },
    },
  };
};

const layoutItem = (name: string, y: number) => {
  return {
    kind: 'GridLayoutItem',
    spec: {
      x: 0,
      y,
      width: 4,
      height: 6,
      element: {
        kind: 'ElementReference',
        name,
      },
    },
  };
};

describe('DashboardDefinitionRenderer', () => {
  test('renders panels from the dashboard layout in order', () => {
    const registry = createPanelRegistry<{ prefix: string }>([
      {
        group: 'veno.live-glucose',
        render: ({ context }) => <div>{context.prefix} current glucose</div>,
      },
      {
        group: 'veno.shared-timers',
        render: ({ context }) => <div>{context.prefix} timers</div>,
      },
      {
        group: 'veno.connections-map',
        render: ({ context }) => <div>{context.prefix} connections</div>,
      },
    ]);

    render(
      <DashboardDefinitionRenderer
        dashboard={createOverviewDashboardDefinition()}
        panelRegistry={registry}
        context={{ prefix: 'Overview' }}
      />,
    );

    expect(screen.getByText('Overview current glucose')).toBeInTheDocument();
    expect(screen.getByText('Overview timers')).toBeInTheDocument();
    expect(screen.getByText('Overview connections')).toBeInTheDocument();
  });
});
