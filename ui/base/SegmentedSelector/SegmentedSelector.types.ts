import type { ReactNode } from 'react';
import type { Stylable } from '../../types';

export interface SegmentedSelectorOption<T extends string> {
  value: T;
  label: ReactNode;
}

export type SegmentedSelectorOptions<T extends string> = readonly [
  SegmentedSelectorOption<T>,
  SegmentedSelectorOption<T>,
  ...SegmentedSelectorOption<T>[],
];

export type SegmentedSelectorProps<T extends string> = Stylable & {
  ariaLabel?: string;
  options: SegmentedSelectorOptions<T>;
  value: T;
  onChange: (value: T) => void;
};
