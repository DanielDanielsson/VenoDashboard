// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AlignmentOptionButton } from './AlignmentOptionButton';

describe('AlignmentOptionButton', () => {
  test('renders a selected labelled option with preview content', () => {
    render(
      <AlignmentOptionButton label="Vertical" selected>
        <span data-testid="preview" />
      </AlignmentOptionButton>,
    );

    expect(screen.getByRole('button', { name: 'Vertical' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Vertical' })).toHaveTextContent(
      'Vertical',
    );
    expect(screen.getByText('Vertical')).toHaveClass('justify-self-center');
    expect(screen.getByRole('button', { name: 'Vertical' })).toHaveClass(
      'grid-rows-[1fr_auto]',
    );
    expect(screen.getByTestId('preview')).toBeInTheDocument();
  });

  test('handles selection clicks', () => {
    const onClick = vi.fn();

    render(
      <AlignmentOptionButton label="Horizontal" onClick={onClick}>
        <span />
      </AlignmentOptionButton>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Horizontal' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
