import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface AlignmentOptionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  label: string;
  selected?: boolean;
}
