// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DashboardErrorState } from './DashboardErrorState';

describe('DashboardErrorState', () => {
  test('renders the title and message', () => {
    render(<DashboardErrorState title="Failed" message="Something broke" />);

    expect(screen.getByRole('heading', { name: 'Failed' })).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });
});
