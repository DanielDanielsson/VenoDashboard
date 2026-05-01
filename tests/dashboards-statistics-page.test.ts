// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const getOwnerSession = vi.fn();
const open = vi.fn();
const loadDashboardResource = vi.fn();
const GlucoseAnalysisView = vi.fn(
  ({
    isOwner,
    initialSnapshot,
    dashboardDefinition,
    dashboardVersion,
  }: {
    isOwner: boolean;
    initialSnapshot?: { meta: { from: string; to: string } };
    dashboardDefinition?: { spec: { uid: string; title: string } };
    dashboardVersion?: number | null;
  }) =>
    React.createElement(
      'div',
      null,
      React.createElement('span', null, `isOwner:${String(isOwner)}`),
      React.createElement('span', null, `from:${initialSnapshot?.meta.from ?? 'none'}`),
      React.createElement('span', null, `dashboard:${dashboardDefinition?.spec.title ?? 'none'}`),
      React.createElement('span', null, `version:${String(dashboardVersion ?? 'none')}`),
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

vi.mock('@/lib/dashboard/resources', () => ({
  loadDashboardResource,
}));

vi.mock('@ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView', () => ({
  GlucoseAnalysisView
}));

describe('dashboards statistics page', () => {
  beforeEach(() => {
    vi.resetModules();
    getOwnerSession.mockReset();
    open.mockReset();
    loadDashboardResource.mockReset();
    GlucoseAnalysisView.mockClear();
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
    loadDashboardResource.mockResolvedValue({
      dashboard: {
        kind: 'Dashboard',
        spec: {
          uid: 'statistics',
          title: 'API Statistics',
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
      type: 'timeRange',
      version: 8,
      source: 'api',
    });
  });

  test('hydrates the analysis view from the public dashboard resource', async () => {
    const { default: DashboardStatisticsPage } = await import('@/app/dashboards/statistics/page');
    render(await DashboardStatisticsPage());

    expect(open).toHaveBeenCalledWith({ range: '3d' });
    expect(loadDashboardResource).toHaveBeenCalledWith('statistics');
    expect(GlucoseAnalysisView).toHaveBeenCalledWith(
      expect.objectContaining({
        isOwner: true,
        dashboardVersion: 8,
        dashboardDefinition: expect.objectContaining({
          spec: expect.objectContaining({
            uid: 'statistics',
            title: 'API Statistics',
          }),
        }),
      }),
      undefined
    );
    expect(screen.getByText('isOwner:true')).toBeInTheDocument();
    expect(screen.getByText('from:2026-03-01T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.getByText('dashboard:API Statistics')).toBeInTheDocument();
    expect(screen.getByText('version:8')).toBeInTheDocument();
  });
});
