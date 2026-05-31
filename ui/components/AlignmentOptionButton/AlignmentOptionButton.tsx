import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import type { AlignmentOptionButtonProps } from './AlignmentOptionButton.types';

export const AlignmentOptionButton = ({
  children,
  className,
  disabled,
  label,
  selected = false,
  ...props
}: AlignmentOptionButtonProps): ReactElement => {
  return (
    <Button
      {...props}
      ariaLabel={label}
      aria-pressed={selected}
      disabled={disabled}
      twStyles={twMerge(
        'grid-drag-cancel grid min-h-28 w-full grid-rows-[1fr_auto] overflow-hidden rounded-[4px] border border-secondary-button-inactive-border bg-secondary-button-inactive-bg px-2 pb-2 pt-2 text-text-soft transition-colors hover:border-secondary-button-active-border hover:text-text',
        selected && 'border-secondary-button-active-border text-text',
        disabled && 'cursor-not-allowed opacity-45 hover:border-secondary-button-inactive-border hover:text-text-soft',
        className,
      )}
    >
      <span className="flex min-h-0 w-full items-center justify-center">
        {children}
      </span>
      <span className="ui_caption pointer-events-none justify-self-center text-center text-current">
        {label}
      </span>
    </Button>
  );
};
