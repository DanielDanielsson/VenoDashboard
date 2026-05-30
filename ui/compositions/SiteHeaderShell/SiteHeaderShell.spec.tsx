// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SiteHeaderShell } from './SiteHeaderShell';

const usePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

describe('SiteHeaderShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('keeps smart scrolling on dashboard routes', () => {
    usePathname.mockReturnValue('/dashboards');

    render(<SiteHeaderShell>Navigation</SiteHeaderShell>);

    expect(screen.getByText('Navigation')).toHaveAttribute('data-header-mode', 'smart');
  });
});
