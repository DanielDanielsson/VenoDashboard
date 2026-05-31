import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { CheckboxProps } from './Checkbox.types';

export const Checkbox = ({
  checked,
  className,
  disabled,
  inputClassName,
  label,
  labelClassName,
  onCheckedChange,
  ...props
}: CheckboxProps): ReactElement => {
  return (
    <label
      className={twMerge(
        'ui_caption flex cursor-pointer items-center gap-3 text-text-dim',
        disabled && 'cursor-not-allowed opacity-60',
        labelClassName,
      )}
    >
      <input
        {...props}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className={twMerge(
          'peer sr-only',
          inputClassName,
        )}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
      <span
        aria-hidden
        className={twMerge(
          'flex h-4 w-4 items-center justify-center rounded-[4px] border border-secondary-button-inactive-border bg-secondary-button-inactive-bg text-transparent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-secondary-button-active-border',
          checked && 'border-secondary-button-active-border bg-secondary-button-active-bg text-secondary-button-active-text',
          className,
        )}
      >
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 6.2 5 8.2 9 3.8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </span>
      <span>{label}</span>
    </label>
  );
};
