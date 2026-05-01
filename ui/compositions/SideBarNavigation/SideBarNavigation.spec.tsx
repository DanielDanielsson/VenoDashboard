// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SideBarNavigation } from './SideBarNavigation';

const usePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

describe('SideBarNavigation', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/dashboards/statistics');
  });

  test('renders pinned dashboards in the dashboards accordion', () => {
    render(
      <SideBarNavigation
        isOwner={false}
        pinnedDashboards={[
          { uid: 'statistics', title: 'Statistics' },
          { uid: 'overview', title: 'Overview' },
        ]}
      />,
    );

    const accordion = screen.getByRole('group', { name: 'Dashboards' });
    const links = within(accordion).getAllByRole('link');

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['All dashboards', '/dashboards'],
      ['Statistics', '/dashboards/statistics'],
      ['Overview', '/dashboards/overview'],
    ]);
    expect(screen.queryByRole('button', { name: /pin/i })).not.toBeInTheDocument();
  });
});
