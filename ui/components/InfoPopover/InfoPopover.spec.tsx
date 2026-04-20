// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { InfoPopover } from './InfoPopover';

describe('InfoPopover', () => {
  test('shows tooltip content without dashboard panel chrome', () => {
    render(
      <InfoPopover
        title="Steps"
        body="The steps data comes from my phone."
        sourceValue="Apple HealthKit"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Steps' });
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(screen.getByText('The steps data comes from my phone.')).toBeInTheDocument();
    expect(screen.getByText('Apple HealthKit')).toBeInTheDocument();
    expect(tooltip.querySelector('.dashboard-panel-drag-handle')).toBeNull();
  });

  test('opens on focus for keyboard users', () => {
    render(<InfoPopover title="Help" body="Keyboard accessible" />);

    const trigger = screen.getByRole('button', { name: 'Help' });
    fireEvent.focus(trigger);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Keyboard accessible')).toBeInTheDocument();
  });
});
