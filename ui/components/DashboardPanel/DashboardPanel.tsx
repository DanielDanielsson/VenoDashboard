import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { DashboardPanelProps, DashboardPanelTheme } from './DashboardPanel.types';

const THEME_CLASS: Record<DashboardPanelTheme, string> = {
  light: 'theme-dashboard-panel-light',
  dark: 'theme-dashboard-panel-dark',
};

export const DashboardPanel = ({
  title,
  children,
  headerRight,
  twStyles,
  theme,
}: DashboardPanelProps): ReactElement => (
  <section
    className={twMerge(
      'overflow-hidden rounded-lg rounded-tr-none bg-dashboard-panel-bg',
      theme && THEME_CLASS[theme],
      twStyles,
    )}
  >
    <header className="flex items-center justify-between gap-4 bg-dashboard-panel-header-bg px-6 py-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-dashboard-panel-title">
        {title}
      </h2>
      {headerRight && <div className="flex shrink-0 items-center">{headerRight}</div>}
    </header>
    <div className="p-6">
      {children}
    </div>
  </section>
);
