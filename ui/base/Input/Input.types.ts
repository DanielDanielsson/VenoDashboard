import type { InputHTMLAttributes } from 'react';
import type { Stylable } from '../../types';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>,
  Stylable {
  className?: string;
}
