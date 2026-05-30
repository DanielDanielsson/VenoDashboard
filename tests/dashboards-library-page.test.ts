// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createElement } from 'react';

const getOwnerSession = vi.fn();
const loadDashboardLibrary = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOwnerSession,
}));

vi.mock('@/lib/dashboard/library', () => ({
  loadDashboardLibrary,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboards',
  useRouter: () => ({
    push,
    refresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('dashboards library page', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    loadDashboardLibrary.mockReset();
    push.mockReset();
    refresh.mockReset();
    getOwnerSession.mockResolvedValue(null);
    loadDashboardLibrary.mockResolvedValue({
      dashboards: [
        {
          uid: 'statistics',
          title: 'Statistics',
          type: 'timeRange',
          version: 2,
          updatedAt: '2026-04-20T00:00:00.000Z',
          isHome: true,
          isPinned: true,
        },
        {
          uid: 'overview',
          title: 'Overview',
          type: 'live',
          version: 1,
          updatedAt: '2026-04-10T00:00:00.000Z',
          isHome: false,
          isPinned: false,
        },
      ],
    });
  });

  test('renders public dashboard links without admin controls', async () => {
    const { default: DashboardsPage } = await import('@/app/dashboards/page');
    const { NotificationsProvider } = await import('@ui/compositions/NotificationsProvider');

    render(createElement(NotificationsProvider, null, await DashboardsPage()));

    const list = screen.getByRole('list', { name: 'Dashboards' });
    const items = within(list).getAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole('link', { name: 'Open Statistics dashboard' })).toHaveAttribute('href', '/dashboards/statistics');
    expect(within(items[0]).getByText('Time range')).toBeInTheDocument();
    expect(within(items[0]).getByText('Home')).toBeInTheDocument();
    expect(within(items[0]).getByText('Pinned')).toBeInTheDocument();
    expect(within(items[1]).getByRole('link', { name: 'Open Overview dashboard' })).toHaveAttribute('href', '/dashboards/overview');
    expect(within(items[1]).getByText('Live')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set as home' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete dashboard' })).not.toBeInTheDocument();
  });
});
