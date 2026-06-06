// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { DashboardLibrary } from './DashboardLibrary';

const push = vi.fn();
const refresh = vi.fn();
const usePathnameMock = vi.fn();
const useSearchParamsMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
  usePathname: () => usePathnameMock(),
  useSearchParams: () => useSearchParamsMock(),
}));

const dashboards = [
  {
    uid: 'overview',
    title: 'Overview',
    description: null,
    icon: 'dashboard-grid' as const,
    defaultTimeRange: null,
    type: 'live' as const,
    version: 1,
    updatedAt: '2026-04-10T00:00:00.000Z',
    isHome: true,
    isPinned: false,
  },
  {
    uid: 'statistics',
    title: 'Statistics',
    description: {
      version: 1 as const,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph' as const,
          spans: [{ text: 'Long range glucose reports and AGP.' }],
        },
      ],
    },
    icon: 'activity' as const,
    defaultTimeRange: '3d' as const,
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
    usePathnameMock.mockReset();
    useSearchParamsMock.mockReset();
    usePathnameMock.mockReturnValue('/dashboards');
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    window.history.replaceState(null, '', '/dashboards');
    window.scrollTo = vi.fn();
    document.documentElement.style.setProperty('--duration-dashboard-order', '1ms');
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
    expect(screen.getByRole('button', { name: 'Drag Overview to reorder' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#grabber',
    );
    expect(overviewLink).toHaveAttribute('href', '/dashboards/overview');
    expect(within(library).getByText('Overview')).toBeInTheDocument();
    expect(within(library).getAllByText('Live')).toHaveLength(1);
    expect(within(library).getByText('Home')).toBeInTheDocument();
    expect(statisticsLink).toHaveAttribute('href', '/dashboards/statistics');
    expect(within(library).getByText('Statistics')).toBeInTheDocument();
    expect(
      Array.from(statisticsLink.closest('article')?.querySelectorAll('use') ?? [])
        .map((node) => node.getAttribute('href')),
    ).toContain('/static_assets/iconSprite.svg#activity');
    expect(within(library).getByText('Long range glucose reports and AGP.')).toBeInTheDocument();
    expect(within(library).getByText('Time range')).toBeInTheDocument();
    expect(
      Array.from(within(library).getByText('Time range').closest('span')?.querySelectorAll('use') ?? [])
        .map((node) => node.getAttribute('href')),
    ).toContain('/static_assets/iconSprite.svg#clock');
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
            dashboardOrderUids: ['overview', 'statistics'],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          preferences: {
            homeDashboardUid: 'overview',
            pinnedDashboardUids: ['overview'],
            dashboardOrderUids: ['overview', 'statistics'],
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
          dashboardOrderUids: ['overview', 'statistics'],
        }),
      }));
    });

    expect(screen.getByRole('button', { name: 'Unpin Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unpin Overview' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#bookmark-filled',
    );
    expect(refresh).not.toHaveBeenCalled();
    let notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard pinned').closest('[data-variant="success"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Unpin Statistics' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('/api/dashboard/preferences', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          homeDashboardUid: 'overview',
          pinnedDashboardUids: ['overview'],
          dashboardOrderUids: ['overview', 'statistics'],
        }),
      }));
    });

    expect(screen.getByRole('button', { name: 'Pin Statistics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin Statistics' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#bookmark',
    );
    expect(refresh).not.toHaveBeenCalled();
    notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard unpinned').closest('[data-variant="success"]')).toBeInTheDocument();
  });

  test('admin users can move dashboards into a persisted order', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        preferences: {
          homeDashboardUid: 'overview',
          pinnedDashboardUids: ['statistics'],
          dashboardOrderUids: ['statistics', 'overview'],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    const library = screen.getByRole('list', { name: 'Dashboards' });
    const statisticsGrabber = screen.getByRole('button', { name: 'Drag Statistics to reorder' });

    fireEvent.keyDown(statisticsGrabber, { key: 'ArrowUp' });

    await waitFor(() => {
      expect(within(library).getAllByRole('link', { name: /Open .* dashboard/ }).map((link) => (
        link.getAttribute('href')
      ))).toEqual(['/dashboards/statistics', '/dashboards/overview']);
    });
    const settledRow = within(library).getByRole('link', { name: 'Open Statistics dashboard' }).closest('li');

    expect(settledRow).toHaveClass('dashboard-library-row');
    expect(settledRow).toHaveAttribute('data-dashboard-order-state', 'settled');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/preferences', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          homeDashboardUid: 'overview',
          pinnedDashboardUids: ['statistics'],
          dashboardOrderUids: ['statistics', 'overview'],
        }),
      }));
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  test('keeps the current scroll position when reordering an expanded dashboard row', async () => {
    const scrollTo = vi.fn();
    const originalScrollTo = window.scrollTo;
    const originalScrollX = Object.getOwnPropertyDescriptor(window, 'scrollX');
    const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 });
    window.scrollTo = scrollTo;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        preferences: {
          homeDashboardUid: 'overview',
          pinnedDashboardUids: ['statistics'],
          dashboardOrderUids: ['statistics', 'overview'],
        },
      }),
    }));

    try {
      render(
        <NotificationsProvider>
          <DashboardLibrary dashboards={dashboards} isOwner />
        </NotificationsProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open Statistics settings' }));
      expect(screen.getByRole('region', { name: 'Statistics settings' })).toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole('button', { name: 'Drag Statistics to reorder' }), {
        key: 'ArrowUp',
      });

      await waitFor(() => {
        expect(scrollTo).toHaveBeenCalledTimes(2);
      });
      expect(scrollTo).toHaveBeenCalledWith(0, 420);
    } finally {
      window.scrollTo = originalScrollTo;
      if (originalScrollX) {
        Object.defineProperty(window, 'scrollX', originalScrollX);
      }
      if (originalScrollY) {
        Object.defineProperty(window, 'scrollY', originalScrollY);
      }
    }
  });

  test('failed dashboard order saves keep the optimistic order until refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'API unavailable',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    const library = screen.getByRole('list', { name: 'Dashboards' });
    const statisticsGrabber = screen.getByRole('button', { name: 'Drag Statistics to reorder' });

    fireEvent.keyDown(statisticsGrabber, { key: 'ArrowUp' });

    await waitFor(() => {
      expect(within(library).getAllByRole('link', { name: /Open .* dashboard/ }).map((link) => (
        link.getAttribute('href')
      ))).toEqual(['/dashboards/statistics', '/dashboards/overview']);
    });

    const notifications = await screen.findByRole('region', { name: 'Notifications' });

    expect(within(notifications).getByText('Dashboard order could not be saved').closest('[data-variant="error"]')).toBeInTheDocument();
    expect(within(library).getAllByRole('link', { name: /Open .* dashboard/ }).map((link) => (
      link.getAttribute('href')
    ))).toEqual(['/dashboards/statistics', '/dashboards/overview']);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('keeps the drop indicator visible over the gap between dashboard rows', async () => {
    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    const library = screen.getByRole('list', { name: 'Dashboards' });
    const rows = Array.from(library.querySelectorAll('.dashboard-library-row'));
    const rowRects = [
      { top: 100, bottom: 180, height: 80 },
      { top: 188, bottom: 268, height: 80 },
    ];

    rows.forEach((row, index) => {
      Object.defineProperty(row, 'getBoundingClientRect', {
        value: vi.fn(() => ({
          ...rowRects[index],
          left: 0,
          right: 400,
          width: 400,
          x: 0,
          y: rowRects[index].top,
          toJSON: () => ({}),
        } as DOMRect)),
      });
    });

    const dataTransfer = {
      dropEffect: 'move',
      effectAllowed: 'move',
      setData: vi.fn(),
      setDragImage: vi.fn(),
    };

    fireEvent.dragStart(screen.getByRole('button', { name: 'Drag Overview to reorder' }), {
      dataTransfer,
    });
    fireEvent.dragOver(library, {
      clientY: 184,
      dataTransfer,
    });

    await waitFor(() => {
      const statisticsRow = screen.getByRole('link', { name: 'Open Statistics dashboard' }).closest('li');

      expect(statisticsRow?.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
    });
  });

  test('expands and scrolls dashboard settings from the settings url parameter', async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    useSearchParamsMock.mockReturnValue(new URLSearchParams('settings=statistics'));
    window.history.replaceState(null, '', '/dashboards?settings=statistics');

    try {
      render(
        <NotificationsProvider>
          <DashboardLibrary dashboards={dashboards} isOwner />
        </NotificationsProvider>,
      );

      expect(await screen.findByRole('region', { name: 'Statistics settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close Statistics settings' })).toBeInTheDocument();
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  test('syncs dashboard settings expansion to the url parameter without scrolling', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      render(
        <NotificationsProvider>
          <DashboardLibrary dashboards={dashboards} isOwner />
        </NotificationsProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open Statistics settings' }));

      expect(screen.getByRole('region', { name: 'Statistics settings' })).toBeInTheDocument();
      expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/dashboards?settings=statistics');
      expect(scrollIntoView).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Close Statistics settings' }));

      expect(screen.queryByRole('region', { name: 'Statistics settings' })).not.toBeInTheDocument();
      expect(pushStateSpy).toHaveBeenLastCalledWith(null, '', '/dashboards');
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  test('admin users can set a dashboard as home after confirmation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          preferences: {
            homeDashboardUid: 'statistics',
            pinnedDashboardUids: ['statistics'],
            dashboardOrderUids: ['overview', 'statistics'],
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    expect(screen.getByRole('button', { name: 'Overview is home dashboard' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Overview is home dashboard' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#home-filled',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set Statistics as home dashboard' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Set home dashboard?' })).toBeInTheDocument();
    expect(screen.getByText('Set Statistics as the home dashboard? Only one dashboard can be home at a time.')).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Set home dashboard?' })).getByRole('button', {
      name: 'Set Statistics as home dashboard',
    }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/preferences', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          homeDashboardUid: 'statistics',
          pinnedDashboardUids: ['statistics'],
          dashboardOrderUids: ['overview', 'statistics'],
        }),
      }));
    });

    expect(screen.queryByRole('dialog', { name: 'Set home dashboard?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Overview as home dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Statistics is home dashboard' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Statistics is home dashboard' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#home-filled',
    );
    expect(refresh).not.toHaveBeenCalled();
    const notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Home dashboard updated').closest('[data-variant="success"]')).toBeInTheDocument();
  });

  test('failed home dashboard saves use error notifications', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'Home dashboard must exist.',
        },
      }),
    }));

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set Statistics as home dashboard' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Set home dashboard?' })).getByRole('button', {
      name: 'Set Statistics as home dashboard',
    }));

    const notifications = await screen.findByRole('region', { name: 'Notifications' });
    await waitFor(() => {
      expect(within(notifications).getByText('Dashboard could not be set as home').closest('[data-variant="error"]')).toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: 'Set home dashboard?' })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
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
    const dialog = screen.getByRole('dialog', { name: 'Create Dashboard' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create dashboard' }));

    let notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard name is required').closest('[data-variant="error"]')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Select Time range dashboard type' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: 'Select Live dashboard type' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.change(within(dialog).getByLabelText('Dashboard name'), {
      target: { value: 'Night view' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activity' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Time range selected: Last 3 days' }));
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create dashboard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/dashboards', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Night view',
          description: null,
          icon: 'activity',
          defaultTimeRange: '7d',
          type: 'timeRange',
        }),
      }));
    });

    notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard created').closest('[data-variant="success"]')).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith('/dashboards/night-view');
  });

  test('failed dashboard creation shows an error notification', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'Dashboard type must be live or timeRange.',
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
    const dialog = screen.getByRole('dialog', { name: 'Create Dashboard' });

    fireEvent.change(within(dialog).getByLabelText('Dashboard name'), {
      target: { value: 'Night view' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Select Live dashboard type' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create dashboard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/dashboards', expect.objectContaining({
        body: JSON.stringify({
          title: 'Night view',
          description: null,
          icon: 'dashboard-grid',
          defaultTimeRange: null,
          type: 'live',
        }),
      }));
      const notifications = screen.getByRole('region', { name: 'Notifications' });
      expect(within(notifications).getByText('Dashboard could not be created').closest('[data-variant="error"]')).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
  });

  test('admin users can delete API backed dashboards from metadata settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dashboardUid: 'overview',
        preferences: {
          homeDashboardUid: 'statistics',
          pinnedDashboardUids: [],
          dashboardOrderUids: ['statistics'],
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Overview settings' }));
    expect(screen.getByRole('button', { name: 'Delete Overview' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#trash',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Overview' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/dashboards/overview', expect.objectContaining({
        method: 'DELETE',
      }));
    });

    expect(screen.queryByRole('link', { name: 'Open Overview dashboard' })).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    const notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard deleted').closest('[data-variant="success"]')).toBeInTheDocument();
  });

  test('admin users can save dashboard metadata without refreshing the library page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        previousUid: 'statistics',
        dashboard: {
          uid: 'reports',
          title: 'Reports',
          description: dashboards[1].description,
          icon: 'activity',
          defaultTimeRange: '7d',
          version: 3,
        },
        preferences: {
          homeDashboardUid: 'overview',
          pinnedDashboardUids: ['reports'],
          dashboardOrderUids: ['overview', 'reports'],
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Statistics settings' }));
    fireEvent.change(screen.getByLabelText('Dashboard name'), {
      target: { value: 'Reports' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Time range selected: Last 3 days' }));
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save dashboard settings' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/dashboards/statistics', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Reports',
          description: dashboards[1].description,
          icon: 'activity',
          defaultTimeRange: '7d',
          expectedVersion: 2,
        }),
      }));
    });

    expect(screen.getByRole('link', { name: 'Open Reports dashboard' })).toHaveAttribute('href', '/dashboards/reports');
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    const notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard settings saved').closest('[data-variant="success"]')).toBeInTheDocument();
  });

  test('admin users can duplicate dashboards from expanded settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dashboard: {
          uid: 'statistics-copy',
          title: 'Statistics - copy',
          description: dashboards[1].description,
          icon: 'activity',
          defaultTimeRange: '3d',
          type: 'timeRange',
          version: 1,
          updatedAt: '2026-05-29T04:20:00.000Z',
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Statistics settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Statistics' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/dashboards/statistics/duplicate', expect.objectContaining({
        method: 'POST',
      }));
    });

    expect(screen.getByRole('link', { name: 'Open Statistics - copy dashboard' })).toHaveAttribute(
      'href',
      '/dashboards/statistics-copy',
    );
    expect(refresh).toHaveBeenCalled();
    const notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Dashboard duplicated').closest('[data-variant="success"]')).toBeInTheDocument();
  });

  test('failed dashboard duplication uses error notifications', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'Failed to copy dashboard settings.',
        },
      }),
    }));

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Statistics settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Statistics' }));

    const notifications = await screen.findByRole('region', { name: 'Notifications' });
    await waitFor(() => {
      expect(within(notifications).getByText('Dashboard could not be duplicated').closest('[data-variant="error"]')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Open Statistics - copy dashboard' })).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  test('admin users must confirm before discarding unsaved metadata changes', () => {
    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Statistics settings' }));
    fireEvent.change(screen.getByLabelText('Dashboard name'), {
      target: { value: 'Reports' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open Overview settings' }));

    expect(screen.getByRole('dialog', { name: 'Discard unsaved dashboard settings?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard name')).toHaveValue('Reports');

    fireEvent.click(screen.getByRole('button', { name: 'Discard settings changes' }));

    expect(screen.queryByRole('dialog', { name: 'Discard unsaved dashboard settings?' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Overview settings' })).toBeInTheDocument();
  });

  test('admin users can close settings without confirmation after reverting metadata changes', () => {
    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Statistics settings' }));
    fireEvent.change(screen.getByLabelText('Dashboard name'), {
      target: { value: 'Reports' },
    });
    fireEvent.change(screen.getByLabelText('Dashboard name'), {
      target: { value: 'Statistics' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close Statistics settings' }));

    expect(screen.queryByRole('dialog', { name: 'Discard unsaved dashboard settings?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Statistics settings' })).not.toBeInTheDocument();
  });

  test('public visitors can preview settings but cannot save them', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <DashboardLibrary dashboards={dashboards} isOwner={false} />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Statistics settings' }));
    expect(screen.getByText('Sign in to save dashboard settings.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Dashboard name'), {
      target: { value: 'Reports' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save dashboard settings' }));

    expect(fetchMock).not.toHaveBeenCalled();
    const notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Sign in to save dashboard settings').closest('[data-variant="error"]')).toBeInTheDocument();
  });
});
