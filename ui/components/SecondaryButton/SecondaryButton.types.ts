import type { ButtonHTMLAttributes } from 'react';
import type { Stylable, Themable } from '../../types';

export type SecondaryButtonTheme = 'light' | 'dark';

export type SecondaryButtonProps = Stylable & Themable<SecondaryButtonTheme> & ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive?: boolean;
};
