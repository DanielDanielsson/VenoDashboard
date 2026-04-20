import type { ReactNode } from 'react';
import type { Stylable } from '../../types';

export type DialogPanelProps = Stylable & {
  title: string;
  children: ReactNode;
  widthClassName?: string;
  overlayTestId?: string;
};
