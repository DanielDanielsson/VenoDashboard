import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { Input } from '@ui/base/Input';
import type { TextInputProps } from './TextInput.types';
import './textInput.css';

export const TextInput = ({
  ariaLabel,
  disabled,
  inputTwStyles,
  label,
  onChange,
  twStyles,
  value,
  ...props
}: TextInputProps): ReactElement => (
  <label
    className={twMerge(
      'grid gap-1.5',
      disabled && 'opacity-60',
      twStyles,
    )}
  >
    <span className="ui_micro_label text-text-soft">{label}</span>
    <Input
      {...props}
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      twStyles={twMerge(
        'ui_caption grid-drag-cancel w-full rounded-[4px] border border-text-input-border bg-text-input-bg px-3 py-2 text-text-input-text transition-colors placeholder:text-text-input-placeholder focus:border-text-input-focus-border focus:outline-none disabled:cursor-not-allowed',
        inputTwStyles,
      )}
    />
  </label>
);
