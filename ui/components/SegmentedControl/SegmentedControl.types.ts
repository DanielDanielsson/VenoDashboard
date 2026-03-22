import type { Stylable } from '../../types';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export type SegmentedControlProps<T extends string> = Stylable & {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
};
