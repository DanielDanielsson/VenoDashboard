import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  inputClassName?: string;
  label: ReactNode;
  labelClassName?: string;
  onCheckedChange?: (checked: boolean) => void;
}
