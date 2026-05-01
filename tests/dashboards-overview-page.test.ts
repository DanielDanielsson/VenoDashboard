// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const getOwnerSession = vi.fn();
const fetchApiStatus = vi.fn();
const fetchAdminHealthSteps = vi.fn();
const fetchConsumerProfile = vi.fn();
const listApiKeys = vi.fn();
const fetchTandemBasalHistory = vi.fn();
const fetchTandemEventHistory = vi.fn();
const buildConnectionMapSnapshot = vi.fn();
const loadDashboardResource = vi.fn();
const OverviewDashboardView = vi.fn(
  ({ dashboard }: { dashboard: { spec: { uid: string; title: string } } }) =>
    React.createElement('div', null, `Rendered dashboard ${dashboard.spec.uid}:${dashboard.spec.title}`),
);

vi.mock('@/lib/auth', () => ({
  getOwnerSession,
}));

vi.mock('@/lib/pulse-api/client', () => ({
  PulseApiClientError: class PulseApiClientError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  fetchAdminHealthSteps,
  fetchApiStatus,
  fetchConsumerProfile,
  listApiKeys,
}));

vi.mock('@/lib/pulse-api/glucose', () => ({
  fetchTandemBasalHistory,
  fetchTandemEventHistory,
}));

vi.mock('@/lib/dashboard/connection-map', () => ({
  buildConnectionMapSnapshot,
  getLatestHealthStepBucketEnd: () => null,
  getLatestTandemActivityAt: () => null,
}));

vi.mock('@/lib/dashboard/resources', () => ({
  loadDashboardResource,
}));

vi.mock('@ui/compositions/OverviewDashboardView/OverviewDashboardView', () => ({
  OverviewDashboardView,
}));

describe('dashboards overview page', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    fetchApiStatus.mockReset();
    fetchAdminHealthSteps.mockReset();
    fetchConsumerProfile.mockReset();
    listApiKeys.mockReset();
    fetchTandemBasalHistory.mockReset();
    fetchTandemEventHistory.mockReset();
    buildConnectionMapSnapshot.mockReset();
    loadDashboardResource.mockReset();
    OverviewDashboardView.mockClear();

    getOwnerSession.mockResolvedValue(null);
    fetchApiStatus.mockResolvedValue({
      generatedAt: '2026-04-19T00:00:00.000Z',
      official: {
        stable: true,
        connected: true,
        latestReading: {
          timestamp: '2026-04-19T00:00:00.000Z',
          valueMmolL: 6.2,
          valueMgDl: 112,
          trend: 'flat',
        },
        sourceToDbLagMinutes: 1,
        latestReadingAgeMinutes: 2,
      },
      share: {
        stable: true,
        connected: true,
        latestReading: null,
        sourceToDbLagMinutes: null,
        latestReadingAgeMinutes: null,
      },
      tandem: {
        stable: true,
        connected: true,
        latestReading: null,
        sourceToDbLagMinutes: null,
        latestReadingAgeMinutes: null,
      },
    });
    fetchAdminHealthSteps.mockResolvedValue({ items: [] });
    fetchConsumerProfile.mockResolvedValue({
      profile: {
        firstName: 'Daniel',
        displayName: 'Daniel Danielsson',
      },
    });
    listApiKeys.mockResolvedValue({ items: [] });
    fetchTandemBasalHistory.mockResolvedValue({ items: [] });
    fetchTandemEventHistory.mockResolvedValue({ items: [] });
    buildConnectionMapSnapshot.mockReturnValue({
      updatedAt: '2026-04-19T00:00:00.000Z',
      nodes: [],
      edges: [],
    });
    loadDashboardResource.mockResolvedValue({
      dashboard: {
        kind: 'Dashboard',
        spec: {
          uid: 'overview',
          title: 'API Overview',
          timeSettings: {
            autoRefresh: '',
            autoRefreshIntervals: ['5s'],
          },
          elements: {},
          layout: {
            kind: 'GridLayout',
            spec: {
              items: [],
            },
          },
        },
      },
      type: 'live',
      version: 4,
      source: 'api',
    });
  });

  test('renders the overview dashboard from the public dashboard resource', async () => {
    const { default: DashboardOverviewPage } = await import('@/app/dashboards/overview/page');
    render(await DashboardOverviewPage());

    expect(loadDashboardResource).toHaveBeenCalledWith('overview');
    expect(screen.getByText('Rendered dashboard overview:API Overview')).toBeInTheDocument();
    expect(OverviewDashboardView).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardVersion: 4,
        dashboard: expect.objectContaining({
          spec: expect.objectContaining({
            uid: 'overview',
            title: 'API Overview',
          }),
        }),
      }),
      undefined,
    );
  });
});
