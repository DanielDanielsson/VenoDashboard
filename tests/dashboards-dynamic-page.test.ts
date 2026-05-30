// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createElement } from 'react';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';

const getOwnerSession = vi.fn();
const loadDashboardResource = vi.fn();
const open = vi.fn();
const fetchApiStatus = vi.fn();
const fetchAdminHealthSteps = vi.fn();
const fetchTandemBasalHistory = vi.fn();
const fetchTandemEventHistory = vi.fn();
const listApiKeys = vi.fn();
const OverviewDashboardView = vi.fn(
  ({
    dashboard,
    dashboardVersion,
    context,
    allowDashboardDelete,
  }: {
    dashboard: { spec: { title: string; uid: string } };
    dashboardVersion?: number | null;
    context: { isOwner: boolean };
    allowDashboardDelete?: boolean;
  }) => createElement(
    'div',
    null,
    createElement('span', null, `overview:${dashboard.spec.title}`),
    createElement('span', null, `overviewVersion:${String(dashboardVersion ?? 'none')}`),
    createElement('span', null, `overviewOwner:${String(context.isOwner)}`),
    createElement('span', null, `overviewDelete:${String(Boolean(allowDashboardDelete))}`),
  ),
);
const GlucoseAnalysisView = vi.fn(
  ({
    dashboardDefinition,
    dashboardVersion,
    initialSelection,
    isOwner,
  }: {
    dashboardDefinition?: { spec: { title: string; uid: string } };
    dashboardVersion?: number | null;
    initialSelection?: { kind: string; range?: string };
    isOwner: boolean;
  }) => createElement(
    'div',
    null,
    createElement('span', null, `analysis:${dashboardDefinition?.spec.title ?? 'none'}`),
    createElement('span', null, `analysisVersion:${String(dashboardVersion ?? 'none')}`),
    createElement('span', null, `analysisSelection:${initialSelection?.kind === 'preset' ? initialSelection.range : 'custom'}`),
    createElement('span', null, `analysisOwner:${String(isOwner)}`),
  ),
);
const refresh = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('Not found');
  }),
  useRouter: () => ({
    refresh,
    push,
  }),
}));

vi.mock('@/lib/auth', () => ({
  getOwnerSession,
}));

vi.mock('@/lib/dashboard/resources', () => ({
  DashboardResourceRedirectError: class DashboardResourceRedirectError extends Error {
    dashboardUid: string;

    constructor(dashboardUid: string) {
      super('Dashboard moved.');
      this.dashboardUid = dashboardUid;
    }
  },
  loadDashboardResource,
}));

vi.mock('@/lib/glucose/dashboard-workspace', () => ({
  dashboardGlucoseWorkspace: {
    open,
  },
}));

vi.mock('@/lib/pulse-api/client', () => ({
  fetchAdminHealthSteps,
  fetchApiStatus,
  fetchConsumerProfile: vi.fn(),
  listApiKeys,
  PulseApiClientError: class PulseApiClientError extends Error {},
}));

vi.mock('@/lib/pulse-api/glucose', () => ({
  fetchTandemBasalHistory,
  fetchTandemEventHistory,
}));

vi.mock('@ui/compositions/OverviewDashboardView/OverviewDashboardView', () => ({
  OverviewDashboardView,
}));

vi.mock('@ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView', () => ({
  GlucoseAnalysisView,
}));

describe('dynamic dashboard page', () => {
  beforeEach(() => {
    getOwnerSession.mockReset();
    loadDashboardResource.mockReset();
    open.mockReset();
    OverviewDashboardView.mockClear();
    GlucoseAnalysisView.mockClear();
    fetchApiStatus.mockReset();
    fetchAdminHealthSteps.mockReset();
    fetchTandemBasalHistory.mockReset();
    fetchTandemEventHistory.mockReset();
    listApiKeys.mockReset();
    refresh.mockReset();
    push.mockReset();
    fetchApiStatus.mockResolvedValue({
      official: {
        connected: true,
        stable: true,
        latestReadingAgeMinutes: 5,
        latestReading: {
          timestamp: '2026-04-29T04:00:00.000Z',
        },
      },
      share: {
        connected: false,
        stable: false,
        latestReadingAgeMinutes: null,
        latestReading: null,
      },
      tandem: {
        connected: true,
        stable: true,
        latestReadingAgeMinutes: 10,
      },
    });
    fetchAdminHealthSteps.mockResolvedValue({ items: [] });
    fetchTandemBasalHistory.mockResolvedValue({ items: [], meta: {} });
    fetchTandemEventHistory.mockResolvedValue({ items: [], meta: {} });
    listApiKeys.mockResolvedValue({ items: [] });
    open.mockResolvedValue({
      snapshot: {
        items: [],
        basalItems: [],
        eventItems: [],
        stepItems: [],
        latest: null,
        meta: {
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-04T00:00:00.000Z',
          officialCount: 0,
          shareCount: 0,
          mergedCount: 0,
          tandemBasalCount: 0,
          tandemEventCount: 0,
          healthStepCount: 0,
        },
      },
    });
  });

  test('renders an empty created dashboard by uid', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    loadDashboardResource.mockResolvedValue({
      type: 'live',
      version: 1,
      description: {
        version: 1,
        blocks: [
          {
            id: 'block-1',
            type: 'paragraph',
            spans: [{ text: 'Night dashboard description' }],
          },
        ],
      },
      source: 'api',
      dashboard: {
        schemaVersion: 'veno.dashboard.v1',
        kind: 'Dashboard',
        spec: {
          uid: 'night-view',
          title: 'Night view',
          timeSettings: {
            autoRefresh: '',
            autoRefreshIntervals: ['5s', '10s'],
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
    });

    const { default: DashboardPage } = await import('@/app/dashboards/[dashboardUid]/page');

    render(createElement(
      NotificationsProvider,
      null,
      await DashboardPage({
        params: Promise.resolve({ dashboardUid: 'night-view' }),
      }),
    ));

    expect(loadDashboardResource).toHaveBeenCalledWith('night-view');
    expect(screen.getByRole('heading', { name: 'Night view' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Night view settings' })).toHaveAttribute(
      'href',
      '/dashboards?settings=night-view',
    );
    expect(screen.getByText('Night dashboard description')).toBeInTheDocument();
    expect(screen.getByText('overview:Night view')).toBeInTheDocument();
    expect(screen.getByText('overviewVersion:1')).toBeInTheDocument();
    expect(screen.getByText('overviewOwner:true')).toBeInTheDocument();
    expect(screen.getByText('overviewDelete:true')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete dashboard' })).not.toBeInTheDocument();
  });

  test('live dashboards use shared grid actions instead of title action buttons', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    loadDashboardResource.mockResolvedValue({
      type: 'live',
      version: 1,
      source: 'api',
      dashboard: {
        schemaVersion: 'veno.dashboard.v1',
        kind: 'Dashboard',
        spec: {
          uid: 'night-view',
          title: 'Night view',
          timeSettings: {
            autoRefresh: '',
            autoRefreshIntervals: ['5s', '10s'],
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
    });

    const { default: DashboardPage } = await import('@/app/dashboards/[dashboardUid]/page');

    render(createElement(
      NotificationsProvider,
      null,
      await DashboardPage({
        params: Promise.resolve({ dashboardUid: 'night-view' }),
      }),
    ));

    expect(screen.getByRole('heading', { name: 'Night view' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete dashboard' })).not.toBeInTheDocument();
    expect(OverviewDashboardView).toHaveBeenCalledWith(
      expect.objectContaining({
        allowDashboardDelete: true,
      }),
      undefined,
    );
  });

  test('renders a time range dashboard with the analysis view and default range', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    loadDashboardResource.mockResolvedValue({
      type: 'timeRange',
      version: 5,
      defaultTimeRange: '7d',
      description: {
        version: 1,
        blocks: [
          {
            id: 'block-1',
            type: 'paragraph',
            spans: [{ text: 'Training dashboard description' }],
          },
        ],
      },
      source: 'api',
      dashboard: {
        schemaVersion: 'veno.dashboard.v1',
        kind: 'Dashboard',
        spec: {
          uid: 'training-review',
          title: 'Training review',
          timeSettings: {
            autoRefresh: '',
            autoRefreshIntervals: ['5s', '10s'],
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
    });

    const { default: DashboardPage } = await import('@/app/dashboards/[dashboardUid]/page');

    render(createElement(
      NotificationsProvider,
      null,
      await DashboardPage({
        params: Promise.resolve({ dashboardUid: 'training-review' }),
      }),
    ));

    expect(open).toHaveBeenCalledWith({ range: '7d' });
    expect(screen.getByText('Training dashboard description')).toBeInTheDocument();
    expect(screen.getByText('analysis:Training review')).toBeInTheDocument();
    expect(screen.getByText('analysisVersion:5')).toBeInTheDocument();
    expect(screen.getByText('analysisSelection:7d')).toBeInTheDocument();
    expect(screen.getByText('analysisOwner:true')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete dashboard' })).not.toBeInTheDocument();
  });

  test('hydrates a time range dashboard from preset URL parameters', async () => {
    getOwnerSession.mockResolvedValue(null);
    loadDashboardResource.mockResolvedValue({
      type: 'timeRange',
      version: 5,
      source: 'api',
      dashboard: {
        schemaVersion: 'veno.dashboard.v1',
        kind: 'Dashboard',
        spec: {
          uid: 'training-review',
          title: 'Training review',
          timeSettings: {
            autoRefresh: '',
            autoRefreshIntervals: ['5s', '10s'],
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
    });

    const { default: DashboardPage } = await import('@/app/dashboards/[dashboardUid]/page');

    render(createElement(
      NotificationsProvider,
      null,
      await DashboardPage({
        params: Promise.resolve({ dashboardUid: 'training-review' }),
        searchParams: Promise.resolve({
          from: 'now-7d',
          to: 'now',
          timezone: 'browser',
        }),
      }),
    ));

    expect(open).toHaveBeenCalledWith({ range: '7d' });
    expect(screen.getByText('analysisOwner:false')).toBeInTheDocument();
  });

  test('passes live dashboard connection context when status data is available', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    loadDashboardResource.mockResolvedValue({
      type: 'live',
      version: 1,
      source: 'api',
      dashboard: {
        schemaVersion: 'veno.dashboard.v1',
        kind: 'Dashboard',
        spec: {
          uid: 'night-view',
          title: 'Night view',
          timeSettings: {
            autoRefresh: '',
            autoRefreshIntervals: ['5s', '10s'],
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
    });
    fetchApiStatus.mockResolvedValue({
      official: {
        connected: true,
        stable: true,
        latestReadingAgeMinutes: 5,
        latestReading: {
          timestamp: '2026-04-29T04:10:00.000Z',
        },
      },
      share: {
        connected: false,
        stable: false,
        latestReadingAgeMinutes: null,
        latestReading: null,
      },
      tandem: {
        connected: true,
        stable: true,
        latestReadingAgeMinutes: 10,
      },
    });
    fetchAdminHealthSteps.mockResolvedValue({ items: [] });
    fetchTandemBasalHistory.mockResolvedValue({ items: [{ timestamp: '2026-04-29T04:05:00.000Z' }] });
    fetchTandemEventHistory.mockResolvedValue({ items: [] });
    listApiKeys.mockResolvedValue({ items: [] });

    const { default: DashboardPage } = await import('@/app/dashboards/[dashboardUid]/page');

    render(createElement(
      NotificationsProvider,
      null,
      await DashboardPage({
        params: Promise.resolve({ dashboardUid: 'night-view' }),
      }),
    ));

    expect(OverviewDashboardView).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          latestReadingTimestamp: '2026-04-29T04:10:00.000Z',
          initialConnectionSnapshot: expect.any(Object),
        }),
      }),
      undefined,
    );
  });
});
