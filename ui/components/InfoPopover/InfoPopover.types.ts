import type { ReactNode } from 'react';
import type { Stylable, Themable } from '../../types';

export type InfoPopoverTheme = 'light' | 'dark';

export type InfoPopoverProps = Stylable &
  Themable<InfoPopoverTheme> & {
    title?: string;
    body: ReactNode;
    ariaLabel?: string;
    sourceLabel?: string;
    sourceValue?: ReactNode;
  };
