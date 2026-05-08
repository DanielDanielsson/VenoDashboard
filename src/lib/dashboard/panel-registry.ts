import type { ReactNode } from 'react';
import type { PanelKind } from './schema';

export interface DashboardPanelRenderInput<TContext = unknown> {
  panelId: string;
  panel: PanelKind;
  context: TContext;
}

export interface DashboardPanelRegistration<TContext = unknown> {
  group: string;
  render: (input: DashboardPanelRenderInput<TContext>) => ReactNode;
}

export interface DashboardPanelRegistry<TContext = unknown> {
  resolve: (group: string) => DashboardPanelRegistration<TContext>;
}

export function createPanelRegistry<TContext = unknown>(
  registrations: Array<DashboardPanelRegistration<TContext>>,
): DashboardPanelRegistry<TContext> {
  const byGroup = new Map(registrations.map((registration) => [registration.group, registration]));

  return {
    resolve(group) {
      const registration = byGroup.get(group);
      if (!registration) {
        throw new Error(`Unknown dashboard panel group "${group}".`);
      }

      return registration;
    },
  };
}
