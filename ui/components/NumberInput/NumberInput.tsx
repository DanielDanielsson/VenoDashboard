import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { NumberInputProps } from './NumberInput.types';

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
      'ui_micro_label inline-flex items-center gap-1.5 text-(--text-soft)',
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
      className="ui_caption_strong w-16 rounded-[4px] border border-[var(--color-secondary-button-inactive-border)] bg-transparent px-2 py-0.5 font-mono text-(--text) transition-colors focus:border-[var(--color-secondary-button-active-border)] focus:outline-none"
      aria-label={ariaLabel ?? label}
    />
  </label>
);
