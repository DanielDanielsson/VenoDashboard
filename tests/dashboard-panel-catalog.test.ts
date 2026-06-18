import { describe, expect, test } from 'vitest';
import { parseDashboardDefinition } from '@/lib/dashboard/schema';
import {
  allowsMultiplePanelInstances,
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
      'veno.dexcom-glucose-readings',
      'veno.glucose-timeline',
      'veno.glucose-agp',
      'veno.text',
    ]);
  });

  test('marks the new Dexcom glucose readings panel as grouped while the old timeline stays top level', () => {
    const dexcomReadings = getPanelCatalogEntry('veno.dexcom-glucose-readings');
    const oldTimeline = getPanelCatalogEntry('veno.glucose-timeline');

    expect(dexcomReadings).toMatchObject({
      id: 'dexcom-glucose-readings',
      elementName: 'panel-dexcom-glucose-readings',
      title: 'Glucose Readings',
      category: {
        kind: 'device',
        label: 'Dexcom G7',
      },
      compatibleDashboardTypes: ['timeRange'],
      defaultLayout: { width: 12, height: 12, aspectRatio: 2.4 },
    });
    expect(oldTimeline?.category).toBeUndefined();
  });

  test('supports multiple readings and text panel instances', () => {
    const timeInRange = getPanelCatalogEntry('veno.time-in-range');
    const dexcomReadings = getPanelCatalogEntry('veno.dexcom-glucose-readings');
    const text = getPanelCatalogEntry('veno.text');

    expect(timeInRange?.compatibleDashboardTypes).toEqual(['timeRange']);
    expect(timeInRange && allowsMultiplePanelInstances(timeInRange)).toBe(true);
    expect(timeInRange?.defaultDefinition.spec.vizConfig.group).toBe('veno.time-in-range');
    expect(dexcomReadings && allowsMultiplePanelInstances(dexcomReadings)).toBe(true);
    expect(text?.compatibleDashboardTypes).toEqual(['live', 'timeRange']);
    expect(text && allowsMultiplePanelInstances(text)).toBe(true);
  });

  test('text panel default content uses the WYSIWYG document schema', () => {
    const text = getPanelCatalogEntry('veno.text');

    expect(text?.defaultDefinition.spec.vizConfig.spec.options).toMatchObject({
      content: {
        version: 1,
        blocks: [
          {
            id: 'intro',
            type: 'paragraph',
            spans: [
              {
                text: 'Add descriptive text for this dashboard.',
              },
            ],
          },
        ],
      },
    });
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
