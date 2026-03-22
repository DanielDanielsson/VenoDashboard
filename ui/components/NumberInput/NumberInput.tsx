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
      'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-soft)',
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
      className="w-16 rounded-[4px] border border-[var(--color-secondary-button-inactive-border)] bg-transparent px-2 py-0.5 font-mono text-[11px] font-semibold leading-[1.6] tracking-[0.05em] text-[var(--color-secondary-button-inactive-text)] transition-colors focus:border-[var(--color-secondary-button-active-border)] focus:text-[var(--color-secondary-button-active-text)] focus:outline-none"
      aria-label={ariaLabel ?? label}
    />
  </label>
);
