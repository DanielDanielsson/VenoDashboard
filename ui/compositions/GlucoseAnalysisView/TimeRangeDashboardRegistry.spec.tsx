// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@ui/compositions/DexcomGlucoseReadingsPanel', () => ({
  DexcomGlucoseReadingsPanel: ({
    isOwner,
    panelId,
    timeWindow,
    timeWindowCacheKey,
    globalGlucoseUnit,
  }: {
    isOwner: boolean;
    panelId: string;
    timeWindow: { from: string; to: string };
    timeWindowCacheKey?: string | null;
    globalGlucoseUnit: string;
  }) => (
    <div>Dexcom panel {panelId} owner {String(isOwner)} window {timeWindow.from} {timeWindow.to} cache {timeWindowCacheKey} unit {globalGlucoseUnit}</div>
  ),
}));

describe('timeRangeDashboardRegistry', () => {
  test('renders the Dexcom glucose readings panel with the dashboard time window', async () => {
    const { timeRangeDashboardRegistry } = await import('./TimeRangeDashboardRegistry');
    const registration = timeRangeDashboardRegistry.resolve('veno.dexcom-glucose-readings');

    render(
      <>
        {registration.render({
          panelId: 'panel-dexcom-glucose-readings',
          panel: {
            kind: 'Panel',
            spec: {
              id: 107,
              title: 'Glucose Readings',
              data: {
                kind: 'QueryGroup',
                spec: {
                  queries: [],
                  transformations: [],
                  queryOptions: {},
                },
              },
              vizConfig: {
                kind: 'VizConfig',
                group: 'veno.dexcom-glucose-readings',
                version: 'v1',
                spec: {
                  options: {},
                  fieldConfig: {
                    defaults: {},
                    overrides: [],
                  },
                },
              },
            },
          },
          context: {
            renderAverageGlucosePanel: () => null,
            renderTimeInRangePanel: () => null,
            renderWorkoutTypesPanel: () => null,
            renderGlucoseTimelinePanel: () => null,
            renderAgpPanel: () => null,
            isOwner: true,
            refreshRevision: 0,
            timeWindow: {
              from: '2026-03-07T10:00:00.000Z',
              to: '2026-03-07T12:00:00.000Z',
            },
            timeWindowCacheKey: 'raw:now-90d:now:Europe/Stockholm',
            globalGlucoseUnit: 'mg/dL',
          },
        })}
      </>,
    );

    expect(screen.getByText('Dexcom panel panel-dexcom-glucose-readings owner true window 2026-03-07T10:00:00.000Z 2026-03-07T12:00:00.000Z cache raw:now-90d:now:Europe/Stockholm unit mg/dL')).toBeInTheDocument();
  });
});
