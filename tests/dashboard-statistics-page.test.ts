// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

const getOwnerSession = vi.fn();
const open = vi.fn();
const GlucoseAnalysisView = vi.fn(
  ({
    isOwner,
    initialSnapshot
  }: {
    isOwner: boolean;
    initialSnapshot?: { meta: { from: string; to: string } };
  }) =>
    React.createElement(
      'div',
      null,
      React.createElement('span', null, `isOwner:${String(isOwner)}`),
      React.createElement('span', null, `from:${initialSnapshot?.meta.from ?? 'none'}`),
      React.createElement('span', null, `to:${initialSnapshot?.meta.to ?? 'none'}`)
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

vi.mock('@ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView', () => ({
  GlucoseAnalysisView
}));

describe('dashboard statistics page', () => {
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
    expect(GlucoseAnalysisView).toHaveBeenCalledWith(
      expect.objectContaining({
        isOwner: true,
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
  });
});
