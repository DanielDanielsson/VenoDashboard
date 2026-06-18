// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DashboardPanel } from './DashboardPanel';

describe('DashboardPanel', () => {
  test('renders title, header content, and children', () => {
    const { container } = render(
      <DashboardPanel title="Stats" headerRight={<span>Right</span>}>
        <p>Body</p>
      </DashboardPanel>,
    );

    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('rounded-[5px]');
    expect(container.firstChild).not.toHaveClass('rounded-tr-none');
    expect(screen.getByRole('heading', { name: 'Stats' }).parentElement).toHaveClass('h-12');
    expect(screen.getByText('Body').parentElement).toHaveClass('p-6');
  });

  test('truncates long titles inside the header row', () => {
    render(
      <DashboardPanel title="A long text panel title that should not push actions outside the panel">
        <p>Body</p>
      </DashboardPanel>,
    );

    expect(screen.getByRole('heading')).toHaveClass('min-w-0', 'flex-1', 'truncate');
  });

  test('allows panel body spacing to be overridden', () => {
    render(
      <DashboardPanel title="Stats" bodyClassName="p-0">
        <p>Body</p>
      </DashboardPanel>,
    );

    expect(screen.getByText('Body').parentElement).toHaveClass('p-0');
    expect(screen.getByText('Body').parentElement).not.toHaveClass('p-6');
  });
});
