import { beforeEach, describe, expect, test, vi } from 'vitest';

const redirect = vi.fn();
const loadDashboardPreferences = vi.fn();

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('@/lib/dashboard/preferences', () => ({
  loadDashboardPreferences,
}));

describe('home dashboard routing', () => {
  beforeEach(() => {
    vi.resetModules();
    redirect.mockReset();
    loadDashboardPreferences.mockReset();
    loadDashboardPreferences.mockResolvedValue({
      homeDashboardUid: 'statistics',
      pinnedDashboardUids: [],
      source: 'api',
    });
  });

  test('redirects the app root to the selected home dashboard', async () => {
    const { default: HomePage } = await import('@/app/page');

    await HomePage();

    expect(loadDashboardPreferences).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/dashboards/statistics');
  });

  test('redirects the legacy dashboard route to the selected home dashboard', async () => {
    const { default: DashboardPage } = await import('@/app/dashboard/page');

    await DashboardPage();

    expect(loadDashboardPreferences).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/dashboards/statistics');
  });

  test('redirects to the dashboard library when no home dashboard exists', async () => {
    loadDashboardPreferences.mockResolvedValueOnce({
      homeDashboardUid: null,
      pinnedDashboardUids: [],
      source: 'api',
    });
    const { default: HomePage } = await import('@/app/page');

    await HomePage();

    expect(loadDashboardPreferences).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/dashboards');
  });

  test('redirects the legacy dashboard route to the dashboard library when no home dashboard exists', async () => {
    loadDashboardPreferences.mockResolvedValueOnce({
      homeDashboardUid: null,
      pinnedDashboardUids: [],
      source: 'api',
    });
    const { default: DashboardPage } = await import('@/app/dashboard/page');

    await DashboardPage();

    expect(loadDashboardPreferences).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/dashboards');
  });

});
