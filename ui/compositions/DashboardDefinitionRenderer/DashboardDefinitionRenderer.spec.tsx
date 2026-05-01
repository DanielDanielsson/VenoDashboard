// @vitest-environment jsdom
import { render as rtlRender, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { createPanelRegistry } from '@/lib/dashboard/panel-registry';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { getDashboardDefinition } from '@/lib/dashboard/registry';
import { DashboardDefinitionRenderer } from './DashboardDefinitionRenderer';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

function render(ui: React.ReactElement) {
  return rtlRender(<NotificationsProvider>{ui}</NotificationsProvider>);
}

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
        dashboard={getDashboardDefinition('overview')}
        panelRegistry={registry}
        context={{ prefix: 'Overview' }}
      />,
    );

    expect(screen.getByText('Overview current glucose')).toBeInTheDocument();
    expect(screen.getByText('Overview timers')).toBeInTheDocument();
    expect(screen.getByText('Overview connections')).toBeInTheDocument();
  });
});
