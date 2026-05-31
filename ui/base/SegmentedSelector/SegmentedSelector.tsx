import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { SegmentedSelectorProps } from './SegmentedSelector.types';

export const SegmentedSelector = <T extends string,>({
  ariaLabel,
  options,
  value,
  onChange,
  twStyles,
}: SegmentedSelectorProps<T>): ReactElement => {
  return (
    <div
      aria-label={ariaLabel}
      className={twMerge(
        'grid-drag-cancel inline-grid grid-flow-col items-center rounded-full border border-secondary-button-inactive-border bg-secondary-button-inactive-bg p-0.5',
        twStyles,
      )}
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={twMerge(
              'ui_caption min-w-16 cursor-pointer rounded-full px-4 py-1.5 text-text-dim transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-button-active-border',
              selected && 'bg-text text-dashboard-panel-bg shadow-sm',
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
