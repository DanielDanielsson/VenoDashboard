import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { SecondaryButton } from '../SecondaryButton';
import type { SegmentedControlProps } from './SegmentedControl.types';

export const SegmentedControl = <T extends string,>({
  options,
  value,
  onChange,
  twStyles,
}: SegmentedControlProps<T>): ReactElement => {
  return (
    <div className={twMerge('inline-flex items-center gap-1', twStyles)}>
      {options.map((option) => (
        <SecondaryButton
          key={option.value}
          isActive={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </SecondaryButton>
      ))}
    </div>
  );
};
