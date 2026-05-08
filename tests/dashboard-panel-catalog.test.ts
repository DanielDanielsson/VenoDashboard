import { describe, expect, test } from 'vitest';
import { parseDashboardDefinition } from '@/lib/dashboard/schema';
import {
  getPanelCatalogEntriesForDashboardType,
  getPanelCatalogEntry,
  validateDashboardPanelCompatibility,
} from '@/lib/dashboard/panel-catalog';

describe('dashboard panel catalog', () => {
  test('classifies live and time range dashboard panels', () => {
    expect(getPanelCatalogEntriesForDashboardType('live').map((entry) => entry.group)).toEqual([
      'veno.live-glucose',
      'veno.connections-map',
      'veno.shared-timers',
      'veno.text',
    ]);
    expect(getPanelCatalogEntriesForDashboardType('timeRange').map((entry) => entry.group)).toEqual([
      'veno.average-glucose',
      'veno.time-in-range',
      'veno.workout-types',
      'veno.glucose-timeline',
      'veno.glucose-agp',
      'veno.text',
    ]);
  });

  test('catalog entries declare compatible dashboard types and multiple instance support', () => {
    const timeInRange = getPanelCatalogEntry('veno.time-in-range');
    const text = getPanelCatalogEntry('veno.text');

    expect(timeInRange?.compatibleDashboardTypes).toEqual(['timeRange']);
    expect(timeInRange?.allowMultiple).toBe(false);
    expect(timeInRange?.defaultDefinition.spec.vizConfig.group).toBe('veno.time-in-range');
    expect(text?.compatibleDashboardTypes).toEqual(['live', 'timeRange']);
    expect(text?.allowMultiple).toBe(true);
  });

  test('rejects a dashboard definition with incompatible panel groups', () => {
    const dashboard = parseDashboardDefinition({
      kind: 'Dashboard',
      spec: {
        uid: 'live-dashboard',
        title: 'Live Dashboard',
        elements: {
          'panel-time-in-range': {
            kind: 'Panel',
            spec: {
              id: 1,
              title: 'Time in Range',
              vizConfig: {
                kind: 'VizConfig',
                group: 'veno.time-in-range',
                version: 'v1',
              },
            },
          },
        },
        layout: {
          kind: 'GridLayout',
          spec: {
            items: [
              {
                kind: 'GridLayoutItem',
                spec: {
                  x: 0,
                  y: 0,
                  width: 4,
                  height: 6,
                  element: {
                    kind: 'ElementReference',
                    name: 'panel-time-in-range',
                  },
                },
              },
            ],
          },
        },
      },
    });

    expect(() => validateDashboardPanelCompatibility(dashboard, 'live')).toThrow(
      'Panel "panel-time-in-range" is not compatible with live dashboards.',
    );
  });
});
