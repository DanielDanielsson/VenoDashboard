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
  headerClassName,
  headerRightClassName,
  twStyles,
  theme,
}: DashboardPanelProps): ReactElement => (
  <section
    className={twMerge(
      'overflow-hidden rounded-[5px] bg-dashboard-panel-bg',
      theme && THEME_CLASS[theme],
      twStyles,
    )}
  >
    <header
      className={twMerge(
        'dashboard-panel-drag-handle flex items-center justify-between gap-4 bg-dashboard-panel-header-bg px-6 py-4',
        headerClassName,
      )}
    >
      <h2 className="panel_title text-dashboard-panel-title">
        {title}
      </h2>
      {headerRight && (
        <div className={twMerge('grid-drag-cancel flex shrink-0 items-center', headerRightClassName)}>
          {headerRight}
        </div>
      )}
    </header>
    <div className="p-6">
      {children}
    </div>
  </section>
);
