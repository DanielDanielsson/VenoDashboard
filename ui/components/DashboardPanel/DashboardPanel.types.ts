import type { ReactNode } from 'react';
import type { Stylable, Themable } from '../../types';

export type DashboardPanelTheme = 'light' | 'dark';

export type DashboardPanelProps = Stylable &
  Themable<DashboardPanelTheme> & {
    title: string;
    children: ReactNode;
    headerRight?: ReactNode;
    headerClassName?: string;
    bodyClassName?: string;
    headerRightClassName?: string;
  };
