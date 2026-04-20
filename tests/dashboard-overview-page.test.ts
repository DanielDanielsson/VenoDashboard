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
const loadDashboardDefinition = vi.fn();
const DashboardDefinitionRenderer = vi.fn(({ dashboard }) =>
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

vi.mock('@/lib/dashboard/settings', () => ({
  loadDashboardDefinition,
}));

vi.mock('@ui/compositions/DashboardDefinitionRenderer', () => ({
  DashboardDefinitionRenderer,
  overviewPanelRegistry: {
    resolve: vi.fn(),
  },
}));

describe('dashboard overview page', () => {
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
    loadDashboardDefinition.mockReset();
    DashboardDefinitionRenderer.mockClear();

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
    loadDashboardDefinition.mockResolvedValue({
      dashboard: {
        kind: 'Dashboard',
        spec: {
          uid: 'overview',
          title: 'Saved Overview',
          elements: {},
          layout: {
            kind: 'GridLayout',
            spec: {
              items: [],
            },
          },
        },
      },
      version: 11,
    });
  });

  test('renders the overview dashboard through the persisted dashboard definition', async () => {
    const { default: DashboardPage } = await import('@/app/dashboard/page');
    render(await DashboardPage());

    expect(loadDashboardDefinition).toHaveBeenCalledWith('overview');
    expect(screen.getByText('Rendered dashboard overview:Saved Overview')).toBeInTheDocument();
    expect(DashboardDefinitionRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardVersion: 11,
        dashboard: expect.objectContaining({
          spec: expect.objectContaining({
            uid: 'overview',
            title: 'Saved Overview',
          }),
        }),
      }),
      undefined,
    );
  });
});
