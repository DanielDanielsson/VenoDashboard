// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SideBarNavigation } from './SideBarNavigation';

const usePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

describe('SideBarNavigation', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/dashboards/statistics');
    localStorage.clear();
    document.documentElement.style.removeProperty('--dashboard-sidebar-width');
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--dashboard-sidebar-width');
  });

  test('renders dashboards as the parent link and pinned dashboards inside the accordion list', () => {
    render(
      <SideBarNavigation
        isOwner={false}
        pinnedDashboards={[
          { uid: 'statistics', title: 'Statistics' },
          { uid: 'overview', title: 'Overview' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Dashboards' })).toHaveAttribute('href', '/dashboards');
    const accordion = screen.getByRole('list', { name: 'Pinned dashboards' });
    const links = within(accordion).getAllByRole('link');

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Statistics', '/dashboards/statistics'],
      ['Overview', '/dashboards/overview'],
    ]);
    expect(screen.getByRole('button', { name: 'Collapse dashboards list' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Collapse dashboards list' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#chevron-up',
    );
    expect(screen.queryByRole('button', { name: /pin/i })).not.toBeInTheDocument();
  });

  test('collapses and expands the pinned dashboard list from a separate icon button', async () => {
    const user = userEvent.setup();
    render(
      <SideBarNavigation
        isOwner
        pinnedDashboards={[
          { uid: 'statistics', title: 'Statistics' },
        ]}
        callsToAction={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Collapse dashboards list' }));

    expect(screen.queryByRole('list', { name: 'Pinned dashboards' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand dashboards list' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Expand dashboards list' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#chevron-down',
    );

    await user.click(screen.getByRole('button', { name: 'Expand dashboards list' }));

    expect(screen.getByRole('list', { name: 'Pinned dashboards' })).toBeInTheDocument();
  });

  test('renders the visitor user block with a placeholder avatar', () => {
    const { container } = render(<SideBarNavigation isOwner={false} pinnedDashboards={[]} callsToAction={[]} />);

    expect(screen.getByText('Visitor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign in for settings' })).toHaveAttribute('href', '/login');
    expect(container.querySelector('img')).toHaveAttribute('src', '/static_assets/avatar-placeholder.svg');
  });

  test('renders the signed in user and profile image when available', () => {
    const { container } = render(
      <SideBarNavigation
        isOwner
        pinnedDashboards={[]}
        currentUser={{ name: 'Alex Rivera', imageUrl: 'https://example.com/alex.png' }}
        callsToAction={[]}
      />,
    );

    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute('href', '/dashboard/settings');
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/alex.png');
  });

  test('collapses the sidebar and persists the selected width', async () => {
    const user = userEvent.setup();
    render(<SideBarNavigation isOwner pinnedDashboards={[]} callsToAction={[]} />);

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar navigation' }));

    expect(screen.getByRole('navigation', { name: 'Sidebar navigation' })).toHaveAttribute('data-sidebar-state', 'collapsed');
    expect(localStorage.getItem('veno-sidebar-collapsed')).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--dashboard-sidebar-width')).toBe('76px');
    expect(screen.getByRole('button', { name: 'Expand sidebar navigation' })).toBeInTheDocument();
  });

  test('renders feedback calls to action above the user block', () => {
    render(
      <SideBarNavigation
        isOwner
        pinnedDashboards={[]}
        callsToAction={[
          {
            id: 'feedback',
            title: 'Feedback',
            body: 'Tell us what you think.',
            href: 'https://forms.example.test',
            actionLabel: 'Share feedback',
          },
        ]}
      />,
    );

    expect(screen.getByLabelText('Feedback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Share feedback' })).toHaveAttribute('href', 'https://forms.example.test');
  });
});
