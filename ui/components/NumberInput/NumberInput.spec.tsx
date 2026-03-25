// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { NumberInput } from './NumberInput';

describe('NumberInput', () => {
  test('forwards numeric changes as strings', () => {
    const onChange = vi.fn();

    render(<NumberInput label="Units" value="4" onChange={onChange} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Units' }), { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith('5');
  });
});
