import type { ButtonHTMLAttributes } from 'react';
import type { Stylable } from '../../types';

export type DashboardPanelHeaderButtonProps = Stylable & ButtonHTMLAttributes<HTMLButtonElement> & {
  ariaLabel?: string;
};
