import type { ReactNode } from 'react';
import type { Stylable, Themable } from '../../types';

export type HoverPanelTheme = 'light' | 'dark';

export type HoverPanelProps = Stylable &
  Themable<HoverPanelTheme> & {
    title?: string;
    body: ReactNode;
    ariaLabel?: string;
    sourceLabel?: string;
    sourceValue?: ReactNode;
  };
