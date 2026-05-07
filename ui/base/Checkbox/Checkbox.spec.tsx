// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  test('renders a labelled checkbox and reports checked changes', () => {
    const onCheckedChange = vi.fn();

    render(
      <Checkbox
        checked={false}
        label="Show source"
        onCheckedChange={onCheckedChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show source' }));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  test('renders the checked visual state from the checked prop', () => {
    render(
      <Checkbox
        checked
        label="Show source"
      />,
    );

    expect(screen.getByText('Show source').previousElementSibling).toHaveClass(
      'bg-secondary-button-active-bg',
      'text-secondary-button-active-text',
    );
  });

  test('applies disabled state to the input and label wrapper', () => {
    render(
      <Checkbox
        checked
        disabled
        label="Disabled option"
        labelClassName="custom-label"
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Disabled option' })).toBeDisabled();
    expect(screen.getByText('Disabled option').closest('label')).toHaveClass(
      'cursor-not-allowed',
      'custom-label',
    );
  });
});
