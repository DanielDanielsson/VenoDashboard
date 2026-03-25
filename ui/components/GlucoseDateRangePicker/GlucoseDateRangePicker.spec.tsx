// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { GlucoseDateRangePicker } from './GlucoseDateRangePicker';

describe('GlucoseDateRangePicker', () => {
  test('opens the picker with a prefilled single-day range when no value exists', () => {
    const onApply = vi.fn();

    render(<GlucoseDateRangePicker value={null} onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));

    expect(screen.getByText('Custom range')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply range' })).toBeEnabled();
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
  });
});
