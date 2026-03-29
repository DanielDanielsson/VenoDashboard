import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { NumberInputProps } from './NumberInput.types';
import './numberInput.css';

export const NumberInput = ({
  label,
  value,
  min,
  step = 1,
  onChange,
  ariaLabel,
  twStyles,
}: NumberInputProps): ReactElement => (
  <label
    className={twMerge(
      'ui_micro_label inline-flex items-center gap-1.5 text-text-soft',
      twStyles,
    )}
  >
    <span>{label}</span>
    <input
      type="number"
      min={min}
      step={step}
      inputMode="numeric"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="ui_mono_text w-28 rounded-[4px] border border-number-input-border bg-number-input-bg px-2 py-0.5 text-number-input-text transition-colors focus:border-number-input-focus-border focus:outline-none"
      aria-label={ariaLabel ?? label}
    />
  </label>
);
