// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SecondaryButton } from './SecondaryButton';

describe('SecondaryButton', () => {
  test('renders active styling and forwards clicks', () => {
    const onClick = vi.fn();

    render(
      <SecondaryButton isActive onClick={onClick}>
        Active
      </SecondaryButton>,
    );

    const button = screen.getByRole('button', { name: 'Active' });
    fireEvent.click(button);

    expect(button).toHaveClass('bg-secondary-button-active-bg');
    expect(button).toHaveClass('enabled:hover:bg-secondary-button-active-bg-hover');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('renders inactive styling by default', () => {
    render(<SecondaryButton>Inactive</SecondaryButton>);

    const button = screen.getByRole('button', { name: 'Inactive' });

    expect(button).toHaveClass('bg-secondary-button-inactive-bg');
    expect(button).toHaveClass('text-secondary-button-inactive-text');
    expect(button).toHaveClass('enabled:hover:bg-secondary-button-inactive-bg-hover');
  });
});
