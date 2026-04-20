import { describe, expect, test } from 'vitest';
import type { GridLayoutItemKind } from '@/lib/dashboard/schema';
import { toDashboardGridLayoutItems, toReactGridLayoutItems } from '@/lib/dashboard/grid-layout';

function gridItem(
  name: string,
  spec: Pick<GridLayoutItemKind['spec'], 'x' | 'y' | 'width' | 'height'>,
): GridLayoutItemKind {
  return {
    kind: 'GridLayoutItem',
    spec: {
      ...spec,
      element: {
        kind: 'ElementReference',
        name,
      },
    },
  };
}

describe('dashboard grid layout adapter', () => {
  test('translates dashboard grid items into react-grid-layout items', () => {
    expect(
      toReactGridLayoutItems([
        gridItem('panel-current-glucose', { x: 0, y: 0, width: 4, height: 6 }),
        gridItem('panel-connections', { x: 0, y: 6, width: 12, height: 8 }),
      ]),
    ).toEqual([
      { i: 'panel-current-glucose', x: 0, y: 0, w: 4, h: 6 },
      { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
    ]);
  });

  test('translates react-grid-layout items back into dashboard grid items', () => {
    expect(
      toDashboardGridLayoutItems([
        { i: 'panel-connections', x: 0, y: 6, w: 12, h: 8 },
        { i: 'panel-current-glucose', x: 0, y: 0, w: 4, h: 6 },
      ]),
    ).toEqual([
      gridItem('panel-connections', { x: 0, y: 6, width: 12, height: 8 }),
      gridItem('panel-current-glucose', { x: 0, y: 0, width: 4, height: 6 }),
    ]);
  });
});
