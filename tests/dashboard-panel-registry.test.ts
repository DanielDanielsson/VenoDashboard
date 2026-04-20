import { describe, expect, test } from 'vitest';
import { createPanelRegistry } from '@/lib/dashboard/panel-registry';

describe('dashboard panel registry', () => {
  test('resolves known visualization groups', () => {
    const render = () => null;
    const registry = createPanelRegistry([
      {
        group: 'veno.live-glucose',
        render,
      },
    ]);

    expect(registry.resolve('veno.live-glucose').render).toBe(render);
  });

  test('reports unknown visualization groups clearly', () => {
    const registry = createPanelRegistry([]);

    expect(() => registry.resolve('veno.unknown')).toThrow('Unknown dashboard panel group "veno.unknown".');
  });
});
