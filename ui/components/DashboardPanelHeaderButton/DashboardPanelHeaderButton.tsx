import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import type { DashboardPanelHeaderButtonProps } from './DashboardPanelHeaderButton.types';

export const DashboardPanelHeaderButton = ({
  children,
  twStyles,
  ...rest
}: DashboardPanelHeaderButtonProps): ReactElement => (
  <Button
    twStyles={twMerge(
      'ui_caption inline-flex h-7 items-center justify-center rounded-[4px] border border-dashboard-panel-header-button-border bg-dashboard-panel-header-button-bg px-2.5 text-dashboard-panel-header-button-text transition-colors',
      'enabled:hover:border-dashboard-panel-header-button-border-hover enabled:hover:bg-dashboard-panel-header-button-bg-hover enabled:hover:text-dashboard-panel-header-button-text-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-panel-header-button-ring',
      twStyles,
    )}
    {...rest}
  >
    {children}
  </Button>
);
