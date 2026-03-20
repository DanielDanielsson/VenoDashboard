import type { ReactNode } from 'react';
import type { Stylable } from '../../types';

export type GridProps = Stylable & {
  children: ReactNode;
  as?: 'div' | 'section' | 'main';
};
