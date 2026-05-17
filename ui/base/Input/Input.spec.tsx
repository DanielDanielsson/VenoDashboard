// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  test('renders as a text input and forwards changes', () => {
    const onChange = vi.fn();

    render(<Input aria-label="Title" value="Text" onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.change(input, { target: { value: 'Notes' } });
    expect(onChange).toHaveBeenCalled();
  });
});
