// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const getOwnerSession = vi.fn();
const open = vi.fn();
const loadDashboardDefinition = vi.fn();
const GlucoseAnalysisView = vi.fn(
  ({
    isOwner,
    initialSnapshot,
    dashboardDefinition,
    dashboardVersion,
    initialSelection,
    initialTimeZone,
  }: {
    isOwner: boolean;
    initialSnapshot?: { meta: { from: string; to: string } };
    dashboardDefinition?: { spec: { uid: string; title: string } };
    dashboardVersion?: number | null;
    initialSelection?: { kind: string; window?: { from: string; to: string } };
    initialTimeZone?: string;
  }) =>
    React.createElement(
      'div',
      null,
      React.createElement('span', null, `isOwner:${String(isOwner)}`),
      React.createElement('span', null, `from:${initialSnapshot?.meta.from ?? 'none'}`),
      React.createElement('span', null, `to:${initialSnapshot?.meta.to ?? 'none'}`),
      React.createElement('span', null, `dashboard:${dashboardDefinition?.spec.title ?? 'none'}`),
      React.createElement('span', null, `version:${String(dashboardVersion ?? 'none')}`),
      React.createElement('span', null, `selection:${initialSelection?.kind ?? 'none'}`),
      React.createElement('span', null, `selection-from:${initialSelection?.window?.from ?? 'none'}`),
      React.createElement('span', null, `selection-to:${initialSelection?.window?.to ?? 'none'}`),
      React.createElement('span', null, `timezone:${initialTimeZone ?? 'none'}`)
    )
);

vi.mock('@/lib/auth', () => ({
  getOwnerSession
}));

vi.mock('@/lib/glucose/dashboard-workspace', () => ({
  dashboardGlucoseWorkspace: {
    open
  }
}));

vi.mock('@/lib/dashboard/settings', () => ({
  loadDashboardDefinition,
}));

vi.mock('@ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView', () => ({
  GlucoseAnalysisView
}));

describe('dashboard statistics page', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    open.mockReset();
    loadDashboardDefinition.mockReset();
    GlucoseAnalysisView.mockClear();
    loadDashboardDefinition.mockResolvedValue({
      dashboard: {
        kind: 'Dashboard',
        spec: {
          uid: 'statistics',
          title: 'Saved Statistics',
          elements: {},
          layout: {
            kind: 'GridLayout',
            spec: {
              items: [],
            },
          },
        },
      },
      version: 7,
    });
  });

  test('hydrates the analysis view with the default workspace snapshot', async () => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
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
          healthStepCount: 0
        }
      }
    });

    const { default: DashboardStatisticsPage } = await import('@/app/dashboard/statistics/page');
    render(await DashboardStatisticsPage());

    expect(open).toHaveBeenCalledWith({ range: '3d' });
    expect(loadDashboardDefinition).toHaveBeenCalledWith('statistics');
    expect(GlucoseAnalysisView).toHaveBeenCalledWith(
      expect.objectContaining({
        isOwner: true,
        dashboardVersion: 7,
        dashboardDefinition: expect.objectContaining({
          spec: expect.objectContaining({
            uid: 'statistics',
            title: 'Saved Statistics',
          }),
        }),
        initialSnapshot: expect.objectContaining({
          meta: expect.objectContaining({
            from: '2026-03-01T00:00:00.000Z',
            to: '2026-03-04T00:00:00.000Z'
          })
        })
      }),
      undefined
    );
    expect(screen.getByText('isOwner:true')).toBeInTheDocument();
    expect(screen.getByText('from:2026-03-01T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.getByText('dashboard:Saved Statistics')).toBeInTheDocument();
  });

  test('hydrates the analysis view from valid statistics URL time params', async () => {
    getOwnerSession.mockResolvedValue(null);
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
          healthStepCount: 0
        }
      }
    });

    const { default: DashboardStatisticsPage } = await import('@/app/dashboard/statistics/page');
    render(await DashboardStatisticsPage({
      searchParams: Promise.resolve({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-04T00:00:00.000Z',
        timezone: 'utc',
      }),
    }));

    expect(open).toHaveBeenCalledWith({
      window: {
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-04T00:00:00.000Z',
      },
    });
    expect(GlucoseAnalysisView).toHaveBeenCalledWith(
      expect.objectContaining({
        isOwner: false,
        initialSelection: {
          kind: 'custom',
          window: {
            from: '2026-03-01T00:00:00.000Z',
            to: '2026-03-04T00:00:00.000Z',
          },
          raw: {
            from: '2026-03-01T00:00:00.000Z',
            to: '2026-03-04T00:00:00.000Z',
          },
        },
        initialTimeZone: 'UTC',
      }),
      undefined
    );
    expect(screen.getByText('selection:custom')).toBeInTheDocument();
    expect(screen.getByText('selection-from:2026-03-01T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.getByText('selection-to:2026-03-04T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.getByText('timezone:UTC')).toBeInTheDocument();
  });
});
