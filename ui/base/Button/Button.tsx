import type { ReactElement, Ref } from 'react';
import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { ButtonProps } from './Button.types';


export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { ariaLabel, children, twStyles, className, ...rest }: ButtonProps,
    ref: Ref<HTMLButtonElement>,
  ): ReactElement | null => (
    <button
      aria-label={ariaLabel}
      className={twMerge(
        'm-0 p-0',
        'appearance-none',
        rest.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer bg-transparent text-current',
        className,
        twStyles,
      )}
      ref={ref}
      type="button"
      {...rest}
    >
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
