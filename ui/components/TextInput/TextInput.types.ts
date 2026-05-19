import type { ReactNode } from 'react';
import type { InputProps } from '@ui/base/Input';
import type { Stylable } from '../../types';

export type TextInputProps = Omit<InputProps, 'type' | 'onChange' | 'twStyles'> & Stylable<'input' | 'label'> & {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
};
