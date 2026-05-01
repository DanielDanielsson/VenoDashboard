// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { DashboardLibrary } from './DashboardLibrary';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}));

const dashboards = [
  {
    uid: 'overview',
    title: 'Overview',
    type: 'live' as const,
    version: 1,
    updatedAt: '2026-04-10T00:00:00.000Z',
    isHome: true,
    isPinned: false,
  },
  {
    uid: 'statistics',
    title: 'Statistics',
    type: 'timeRange' as const,
    version: 2,
    updatedAt: '2026-04-20T00:00:00.000Z',
    isHome: false,
    isPinned: true,
  },
];

describe('DashboardLibrary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
    refresh.mockReset();
  });

  test('renders column labels and clickable dashboard rows', () => {
    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    const library = screen.getByRole('list', { name: 'Dashboards' });
    const header = screen.getByTestId('dashboard-library-header');
    const overviewLink = within(library).getByRole('link', { name: 'Open Overview dashboard' });
    const statisticsLink = within(library).getByRole('link', { name: 'Open Statistics dashboard' });

    expect(within(header).getByText('Name')).toBeInTheDocument();
    expect(within(header).getByText('Type')).toBeInTheDocument();
    expect(within(header).getByText('Tag')).toBeInTheDocument();
    expect(overviewLink).toHaveAttribute('href', '/dashboards/overview');
    expect(within(library).getByText('Overview')).toBeInTheDocument();
    expect(within(library).getAllByText('Live')).toHaveLength(1);
    expect(within(library).getByText('Home')).toBeInTheDocument();
    expect(statisticsLink).toHaveAttribute('href', '/dashboards/statistics');
    expect(within(library).getByText('Statistics')).toBeInTheDocument();
    expect(within(library).getByText('Time range')).toBeInTheDocument();
    expect(within(library).getByText('Pinned')).toBeInTheDocument();
  });

  test('admin users can pin and unpin dashboards with notifications', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          preferences: {
            homeDashboardUid: 'overview',
            pinnedDashboardUids: ['statistics', 'overview'],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          preferences: {
            homeDashboardUid: 'overview',
            pinnedDashboardUids: ['overview'],
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pin Overview' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/preferences', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          homeDashboardUid: 'overview',
          pinnedDashboardUids: ['statistics', 'overview'],
        }),
      }));
    });

    expect(screen.getByRole('button', { name: 'Unpin Overview' })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    let notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard pinned').closest('[data-variant="success"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Unpin Statistics' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('/api/dashboard/preferences', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          homeDashboardUid: 'overview',
          pinnedDashboardUids: ['overview'],
        }),
      }));
    });

    expect(screen.getByRole('button', { name: 'Pin Statistics' })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(2);
    notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard unpinned').closest('[data-variant="success"]')).toBeInTheDocument();
  });

  test('failed pin saves use error notifications', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'Pinned dashboards must exist.',
        },
      }),
    }));

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pin Overview' }));

    const notifications = await screen.findByRole('region', { name: 'Notifications' });
    await waitFor(() => {
      expect(within(notifications).getByText('Dashboard could not be pinned').closest('[data-variant="error"]')).toBeInTheDocument();
    });
  });

  test('admin users can create dashboards with validation notification and redirect', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dashboard: {
            uid: 'night-view',
            title: 'Night view',
            type: 'timeRange',
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create dashboard' }));

    let notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard title is required').closest('[data-variant="error"]')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Dashboard title'), {
      target: { value: 'Night view' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Time range' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create dashboard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/dashboards', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Night view',
          type: 'timeRange',
        }),
      }));
    });

    notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard created').closest('[data-variant="success"]')).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith('/dashboards/night-view');
  });

  test('failed dashboard creation shows an error notification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'Dashboard type must be live or timeRange.',
        },
      }),
    }));

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.change(screen.getByLabelText('Dashboard title'), {
      target: { value: 'Night view' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Live' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create dashboard' }));

    await waitFor(() => {
      const notifications = screen.getByRole('region', { name: 'Notifications' });
      expect(within(notifications).getByText('Dashboard could not be created').closest('[data-variant="error"]')).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
  });

  test('admin users can delete non home dashboards and cannot delete the home dashboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dashboardUid: 'statistics',
        preferences: {
          homeDashboardUid: 'overview',
          pinnedDashboardUids: [],
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    expect(screen.getByRole('button', { name: 'Delete Overview' })).toBeDisabled();
    expect(screen.queryByText('Home dashboard cannot be deleted')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Statistics' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/dashboards/statistics', expect.objectContaining({
        method: 'DELETE',
      }));
    });

    expect(screen.queryByRole('link', { name: 'Statistics' })).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    const notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard deleted').closest('[data-variant="success"]')).toBeInTheDocument();
  });
});
