// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NavigationLink } from './NavigationLink';

const usePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

describe('NavigationLink', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/dashboard');
  });

  test('marks the current path as active', () => {
    render(<NavigationLink href="/dashboard">Overview</NavigationLink>);

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveClass('bg-nav-link-bg-hover');
  });

  test('renders the icon when provided', () => {
    const { container } = render(
      <NavigationLink href="/dashboard/statistics" icon="activity">
        Statistics
      </NavigationLink>,
    );

    expect(container.querySelector('use')).toHaveAttribute('href', '/static_assets/iconSprite.svg#activity');
  });
});
