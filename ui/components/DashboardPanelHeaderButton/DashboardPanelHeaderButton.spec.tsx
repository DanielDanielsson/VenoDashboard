// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DashboardPanelHeaderButton } from './DashboardPanelHeaderButton';

describe('DashboardPanelHeaderButton', () => {
  test('renders subtle dashboard panel header styling and forwards clicks', () => {
    const onClick = vi.fn();

    render(
      <DashboardPanelHeaderButton onClick={onClick}>
        Copy time range
      </DashboardPanelHeaderButton>,
    );

    const button = screen.getByRole('button', { name: 'Copy time range' });
    fireEvent.click(button);

    expect(button).toHaveClass('ui_caption');
    expect(button).toHaveClass('h-7');
    expect(button).toHaveClass('border-dashboard-panel-header-button-border');
    expect(button).toHaveClass('text-dashboard-panel-header-button-text');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
