// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  test('renders a button with default type and aria label', () => {
    render(<Button ariaLabel="Open panel">Open</Button>);

    const button = screen.getByRole('button', { name: 'Open panel' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveTextContent('Open');
    expect(button).toHaveClass('cursor-pointer');
  });

  test('uses a not allowed cursor when disabled', () => {
    render(<Button disabled>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).toHaveClass('cursor-not-allowed');
    expect(button).not.toHaveClass('cursor-pointer');
  });

  test('merges classes and forwards click events', () => {
    const onClick = vi.fn();

    render(
      <Button className="base-class" twStyles="custom-class" onClick={onClick}>
        Click
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Click' });
    fireEvent.click(button);

    expect(button).toHaveClass('base-class');
    expect(button).toHaveClass('custom-class');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
