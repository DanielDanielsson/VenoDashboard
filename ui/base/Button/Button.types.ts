import type { ButtonHTMLAttributes } from 'react';
import { Stylable } from '../../types';


export type ButtonProps = Stylable &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    ariaLabel?: string;
  };
