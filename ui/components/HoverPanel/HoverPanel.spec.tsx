// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { HoverPanel } from './HoverPanel';

describe('HoverPanel', () => {
  test('shows its panel content and source on hover', () => {
    render(
      <HoverPanel
        title="Steps"
        body="The steps data comes from my phone."
        sourceValue="Apple HealthKit"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Steps' });
    fireEvent.mouseEnter(trigger);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('The steps data comes from my phone.')).toBeInTheDocument();
    expect(screen.getByText('Apple HealthKit')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveClass('z-50');
  });
});
