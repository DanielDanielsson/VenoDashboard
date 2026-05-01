// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DropdownMenu } from './DropdownMenu';

describe('DropdownMenu', () => {
  const options = [
    { value: 'live', label: 'Live' },
    { value: 'timeRange', label: 'Time range' },
  ] as const;

  test('renders a styled trigger with a placeholder', () => {
    render(
      <DropdownMenu
        label="Dashboard type"
        placeholder="Select type"
        value=""
        options={options}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Dashboard type' });

    expect(trigger).toHaveTextContent('Select type');
    expect(trigger).toHaveClass('border-dashboard-time-picker-border');
    expect(trigger).toHaveClass('bg-dashboard-time-picker-bg');
    expect(trigger).toHaveClass('text-dashboard-time-picker-text');
  });

  test('opens options and emits the selected value', () => {
    const onChange = vi.fn();

    render(
      <DropdownMenu
        label="Dashboard type"
        placeholder="Select type"
        value=""
        options={options}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Time range' }));

    expect(onChange).toHaveBeenCalledWith('timeRange');
    expect(screen.queryByRole('listbox', { name: 'Dashboard type' })).not.toBeInTheDocument();
  });

  test('closes when escape is pressed', () => {
    render(
      <DropdownMenu
        label="Dashboard type"
        placeholder="Select type"
        value=""
        options={options}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard type' }));
    expect(screen.getByRole('listbox', { name: 'Dashboard type' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('listbox', { name: 'Dashboard type' })).not.toBeInTheDocument();
  });
});
