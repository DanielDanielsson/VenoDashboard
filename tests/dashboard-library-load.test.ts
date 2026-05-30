import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchDashboardList: vi.fn(),
  fetchDashboardPreferences: vi.fn(),
}));

vi.mock('@/lib/pulse-api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pulse-api/client')>();
  return {
    ...actual,
    fetchDashboardList: mocks.fetchDashboardList,
    fetchDashboardPreferences: mocks.fetchDashboardPreferences,
  };
});

describe('dashboard library loading', () => {
  beforeEach(() => {
    mocks.fetchDashboardList.mockReset();
    mocks.fetchDashboardPreferences.mockReset();
  });

  test('sorts pinned dashboards first and unpinned dashboards by updated time', async () => {
    mocks.fetchDashboardList.mockResolvedValue({
      dashboards: [
        {
          uid: 'overview',
          title: 'Overview',
          type: 'live',
          version: 1,
          updatedAt: '2026-04-01T00:00:00.000Z',
          dashboard: { kind: 'Dashboard', spec: { uid: 'overview', title: 'Overview', elements: {}, layout: { kind: 'GridLayout', spec: { items: [] } } } },
        },
        {
          uid: 'training',
          title: 'Training',
          type: 'timeRange',
          version: 1,
          updatedAt: '2026-04-20T00:00:00.000Z',
          dashboard: { kind: 'Dashboard', spec: { uid: 'training', title: 'Training', elements: {}, layout: { kind: 'GridLayout', spec: { items: [] } } } },
        },
        {
          uid: 'statistics',
          title: 'Statistics',
          type: 'timeRange',
          version: 1,
          updatedAt: '2026-04-10T00:00:00.000Z',
          dashboard: { kind: 'Dashboard', spec: { uid: 'statistics', title: 'Statistics', elements: {}, layout: { kind: 'GridLayout', spec: { items: [] } } } },
        },
      ],
    });
    mocks.fetchDashboardPreferences.mockResolvedValue({
      preferences: {
        homeDashboardUid: 'statistics',
        pinnedDashboardUids: ['statistics'],
      },
    });

    const { loadDashboardLibrary } = await import('@/lib/dashboard/library');
    const library = await loadDashboardLibrary();

    expect(library.dashboards.map((dashboard) => dashboard.uid)).toEqual([
      'statistics',
      'training',
      'overview',
    ]);
    expect(library.dashboards.map((dashboard) => ({
      uid: dashboard.uid,
      icon: dashboard.icon,
      defaultTimeRange: dashboard.defaultTimeRange,
      isHome: dashboard.isHome,
      isPinned: dashboard.isPinned,
    }))).toEqual([
      { uid: 'statistics', icon: 'dashboard-grid', defaultTimeRange: '3d', isHome: true, isPinned: true },
      { uid: 'training', icon: 'dashboard-grid', defaultTimeRange: '3d', isHome: false, isPinned: false },
      { uid: 'overview', icon: 'dashboard-grid', defaultTimeRange: null, isHome: false, isPinned: false },
    ]);
  });

  test('rejects when the dashboard list cannot be loaded', async () => {
    mocks.fetchDashboardList.mockRejectedValue(new Error('fetch failed'));
    mocks.fetchDashboardPreferences.mockResolvedValue({
      preferences: {
        homeDashboardUid: 'statistics',
        pinnedDashboardUids: [],
      },
    });

    const { loadDashboardLibrary } = await import('@/lib/dashboard/library');

    await expect(loadDashboardLibrary()).rejects.toThrow('fetch failed');
  });
});
