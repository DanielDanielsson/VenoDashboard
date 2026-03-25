// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  test('marks the current value active and emits changes', () => {
    const onChange = vi.fn();

    render(
      <SegmentedControl
        value="gradient"
        onChange={onChange}
        options={[
          { label: '3 colors', value: 'threeColors' },
          { label: 'Gradient', value: 'gradient' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '3 colors' }));

    expect(screen.getByRole('button', { name: 'Gradient' })).toHaveClass('bg-secondary-button-active-bg');
    expect(onChange).toHaveBeenCalledWith('threeColors');
  });
});
