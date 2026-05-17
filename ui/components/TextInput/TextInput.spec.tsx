// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { TextInput } from './TextInput';

describe('TextInput', () => {
  test('forwards text changes as strings', () => {
    const onChange = vi.fn();

    render(<TextInput label="Title" value="Text" onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Dashboard notes' },
    });

    expect(onChange).toHaveBeenCalledWith('Dashboard notes');
  });
});
