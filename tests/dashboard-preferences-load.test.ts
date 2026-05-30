import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchDashboardPreferences: vi.fn(),
}));

vi.mock('@/lib/pulse-api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pulse-api/client')>();
  return {
    ...actual,
    fetchDashboardPreferences: mocks.fetchDashboardPreferences,
  };
});

describe('dashboard preferences loading', () => {
  beforeEach(() => {
    mocks.fetchDashboardPreferences.mockReset();
  });

  test('loads home dashboard preferences from the public API', async () => {
    mocks.fetchDashboardPreferences.mockResolvedValue({
      preferences: {
        homeDashboardUid: 'statistics',
        pinnedDashboardUids: [],
        dashboardOrderUids: ['statistics', 'overview'],
      },
    });

    const { loadDashboardPreferences } = await import('@/lib/dashboard/preferences');
    const preferences = await loadDashboardPreferences();

    expect(mocks.fetchDashboardPreferences).toHaveBeenCalled();
    expect(preferences).toEqual({
      homeDashboardUid: 'statistics',
      pinnedDashboardUids: [],
      dashboardOrderUids: ['statistics', 'overview'],
      source: 'api',
    });
  });

  test('rejects when the preference API cannot be reached', async () => {
    mocks.fetchDashboardPreferences.mockRejectedValue(new Error('fetch failed'));

    const { loadDashboardPreferences } = await import('@/lib/dashboard/preferences');

    await expect(loadDashboardPreferences()).rejects.toThrow('fetch failed');
  });
});
