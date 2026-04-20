import type { Layout, LayoutItem } from 'react-grid-layout';
import type { GridLayoutItemKind } from './schema';

export function toReactGridLayoutItems(items: GridLayoutItemKind[]): Layout {
  return items.map((item) => ({
    i: item.spec.element.name,
    x: item.spec.x,
    y: item.spec.y,
    w: item.spec.width,
    h: item.spec.height,
  }));
}

export function cloneReactGridLayoutItems(layout: Layout): Layout {
  return layout.map((item: LayoutItem) => ({ ...item }));
}

export function toDashboardGridLayoutItems(layout: Layout): GridLayoutItemKind[] {
  return layout.map((item) => ({
    kind: 'GridLayoutItem',
    spec: {
      x: item.x,
      y: item.y,
      width: item.w,
      height: item.h,
      element: {
        kind: 'ElementReference',
        name: item.i,
      },
    },
  }));
}
