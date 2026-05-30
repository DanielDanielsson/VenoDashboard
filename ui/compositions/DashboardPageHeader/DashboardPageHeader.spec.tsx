// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DashboardPageHeader } from './DashboardPageHeader';

describe('DashboardPageHeader', () => {
  test('links the hover edit action to the dashboard library settings', () => {
    render(
      <DashboardPageHeader
        dashboardUid="training review"
        title="Training review"
        description="Long range glucose reports"
      />,
    );

    const editLink = screen.getByRole('link', { name: 'Edit Training review settings' });

    expect(screen.getByRole('heading', { name: 'Training review' })).toBeInTheDocument();
    expect(screen.getByText('Long range glucose reports')).toBeInTheDocument();
    expect(editLink).toHaveAttribute('href', '/dashboards?settings=training+review');
    expect(editLink).toHaveClass('opacity-0', 'group-hover:opacity-100');
    expect(editLink.querySelector('use')).toHaveAttribute('href', '/static_assets/iconSprite.svg#edit');
  });
});
