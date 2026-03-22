import type { Stylable } from '../../types';

export type NumberInputProps = Stylable & {
  label: string;
  value: string;
  min?: number;
  step?: number;
  onChange: (value: string) => void;
  ariaLabel?: string;
};
