// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SegmentedSelector } from './SegmentedSelector';

describe('SegmentedSelector', () => {
  test('renders two or more options and emits the selected value', () => {
    const onChange = vi.fn();

    render(
      <SegmentedSelector
        ariaLabel="Room"
        value="single"
        onChange={onChange}
        options={[
          { value: 'shared', label: 'Shared' },
          { value: 'single', label: 'Single' },
          { value: 'suite', label: 'Suite' },
        ]}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Room' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Single' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Single' })).toHaveClass(
      'cursor-pointer',
    );
    expect(screen.getByRole('radiogroup', { name: 'Room' })).toHaveClass(
      'border-secondary-button-inactive-border',
    );
    expect(screen.getByRole('radio', { name: 'Shared' })).not.toHaveClass('border');

    fireEvent.click(screen.getByRole('radio', { name: 'Shared' }));

    expect(onChange).toHaveBeenCalledWith('shared');
  });
});
