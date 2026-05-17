import { forwardRef, type ReactElement, type Ref } from 'react';
import { twMerge } from 'tailwind-merge';
import type { InputProps } from './Input.types';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, twStyles, type = 'text', ...props }: InputProps,
    ref: Ref<HTMLInputElement>,
  ): ReactElement => (
    <input
      {...props}
      ref={ref}
      type={type}
      className={twMerge(className, twStyles)}
    />
  ),
);

Input.displayName = 'Input';
