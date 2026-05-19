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

  test('keeps core styling while allowing label and input customization', () => {
    render(
      <TextInput
        label="Title"
        labelTwStyles="text-current"
        inputTwStyles="h-12"
        value="Text"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Title')).toHaveClass('ui_micro_label', 'text-current');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveClass(
      'ui_input_text',
      'bg-text-input-bg',
      'border-text-input-border',
      'h-12',
    );
  });
});
