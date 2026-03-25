// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DashboardPanel } from './DashboardPanel';

describe('DashboardPanel', () => {
  test('renders title, header content, and children', () => {
    render(
      <DashboardPanel title="Stats" headerRight={<span>Right</span>}>
        <p>Body</p>
      </DashboardPanel>,
    );

    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });
});
