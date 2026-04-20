import type { ReactNode } from 'react';
import type { Stylable } from '../../types';

export type FloatingPanelProps = Stylable & {
  title: string;
  children: ReactNode;
};
