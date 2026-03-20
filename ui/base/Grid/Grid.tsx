import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { GridProps } from './Grid.types';

export const Grid = ({
  children,
  twStyles,
  as: Tag = 'div',
}: GridProps): ReactElement => (
  <Tag className={twMerge('grid grid-cols-24 gap-2', twStyles)}>
    {children}
  </Tag>
);
