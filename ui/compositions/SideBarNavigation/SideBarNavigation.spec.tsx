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
    expect(screen.getByRole('navigation', { name: 'Sidebar navigation' })).toHaveClass('border-border');
    expect(document.querySelector('[data-sidebar-primary-nav]')).toHaveClass('mt-3', 'border-t', 'border-border', 'pt-3');
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
    expect(screen.getByRole('list', { name: 'Pinned dashboards', hidden: true }).closest('[data-dashboards-accordion-state]')).toHaveClass('grid-rows-[0fr]');
    expect(screen.getByRole('link', { name: 'Statistics', hidden: true })).toHaveAttribute('tabindex', '-1');
    expect(localStorage.getItem('veno-sidebar-dashboards-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Expand dashboards list' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Expand dashboards list' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#chevron-down',
    );

    await user.click(screen.getByRole('button', { name: 'Expand dashboards list' }));

    expect(screen.getByRole('list', { name: 'Pinned dashboards' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Pinned dashboards' }).closest('[data-dashboards-accordion-state]')).toHaveClass('grid-rows-[1fr]');
    expect(localStorage.getItem('veno-sidebar-dashboards-expanded')).toBe('true');
  });

  test('keeps the dashboards accordion collapsed after navigating to another sidebar link', async () => {
    const user = userEvent.setup();
    const props = {
      isOwner: true,
      pinnedDashboards: [
        { uid: 'statistics', title: 'Statistics' },
      ],
      callsToAction: [],
    };
    const { unmount } = render(<SideBarNavigation {...props} />);

    await user.click(screen.getByRole('button', { name: 'Collapse dashboards list' }));

    expect(screen.queryByRole('list', { name: 'Pinned dashboards' })).not.toBeInTheDocument();

    unmount();
    usePathname.mockReturnValue('/dashboard/about');
    render(<SideBarNavigation {...props} />);

    expect(screen.queryByRole('list', { name: 'Pinned dashboards' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand dashboards list' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('renders the visitor user block with a sprite avatar icon', () => {
    const { container } = render(<SideBarNavigation isOwner={false} pinnedDashboards={[]} callsToAction={[]} />);

    expect(screen.getByText('Visitor')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin sign in' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign in' }).querySelector('use')).toHaveAttribute(
      'href',
      '/static_assets/iconSprite.svg#auth-sign-in',
    );
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('use[href="/static_assets/iconSprite.svg#visitor-avatar"]')).toBeInTheDocument();
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

  test('uses the same larger avatar size in expanded and collapsed sidebar states', async () => {
    const user = userEvent.setup();
    const { container } = render(<SideBarNavigation isOwner pinnedDashboards={[]} callsToAction={[]} />);
    const avatarSlot = container.querySelector('[data-sidebar-avatar]');
    const avatarIcon = container.querySelector('use[href="/static_assets/iconSprite.svg#visitor-avatar"]')?.closest('svg');

    expect(avatarSlot).toHaveClass('h-11', 'w-11', 'flex-none');
    expect(avatarSlot).toHaveClass('rounded-full');
    expect(avatarIcon).toHaveClass('h-6', 'w-6');

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar navigation' }));

    expect(avatarSlot).toHaveClass('h-11', 'w-11', 'flex-none');
    expect(avatarSlot).toHaveClass('rounded-full');
    expect(avatarIcon).toHaveClass('h-6', 'w-6');
  });

  test('keeps the user label anchored while collapsing', async () => {
    const user = userEvent.setup();
    render(<SideBarNavigation isOwner pinnedDashboards={[]} callsToAction={[]} currentUser={{ name: 'Alex Rivera' }} />);

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar navigation' }));

    expect(screen.getByText('Alex Rivera')).toHaveClass('left-14');
  });

  test('places the sidebar collapse control between GitHub and theme controls', () => {
    render(<SideBarNavigation isOwner={false} pinnedDashboards={[]} callsToAction={[]} />);

    const secondaryList = screen.getByRole('link', { name: 'GitHub' }).closest('ul');

    expect(secondaryList).not.toBeNull();
    const githubLink = within(secondaryList as HTMLElement).getByRole('link', { name: 'GitHub' });
    const collapseButton = within(secondaryList as HTMLElement).getByRole('button', { name: 'Collapse sidebar navigation' });
    const themeButton = within(secondaryList as HTMLElement).getByRole('button', { name: /theme/i });

    expect(Boolean(githubLink.compareDocumentPosition(collapseButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(collapseButton.compareDocumentPosition(themeButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  test('fades sidebar navigation labels while switching icons to collapsed layout immediately', async () => {
    const user = userEvent.setup();
    render(<SideBarNavigation isOwner pinnedDashboards={[]} callsToAction={[]} />);

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar navigation' }));

    const navigation = screen.getByRole('navigation', { name: 'Sidebar navigation' });

    expect(navigation).toHaveAttribute('data-sidebar-text-state', 'collapsed');
    expect(screen.getByText('Settings')).toHaveClass('opacity-0');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveClass('grid-cols-[20px]');
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
    expect(screen.getByLabelText('Feedback')).toHaveClass('w-[237px]');
  });

  test('uses the default feedback heading', () => {
    render(<SideBarNavigation isOwner pinnedDashboards={[]} />);

    expect(screen.getByLabelText('Help us improve')).toBeInTheDocument();
    expect(screen.getByText('Help us improve')).toBeInTheDocument();
  });

  test('stacks the feedback icon above the heading with matching vertical rhythm', () => {
    const { container } = render(<SideBarNavigation isOwner pinnedDashboards={[]} />);
    const feedbackCard = screen.getByLabelText('Help us improve');
    const icon = feedbackCard.querySelector('svg');
    const headingGroup = screen.getByText('Help us improve').parentElement;
    const actionLink = screen.getByRole('link', { name: 'Share feedback' });

    expect(icon?.compareDocumentPosition(screen.getByText('Help us improve'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(headingGroup).toHaveClass('mt-3');
    expect(actionLink).toHaveClass('mt-3');
    expect(container.querySelector('[data-feedback-cta-state="expanded"] aside > div')).toBe(headingGroup);
  });

  test('slides feedback calls to action out and marks the avatar when collapsed', async () => {
    const user = userEvent.setup();
    const { container } = render(
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

    expect(screen.getByRole('link', { name: 'Share feedback' })).toBeInTheDocument();
    expect(container.querySelector('[data-sidebar-avatar-notification]')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar navigation' }));

    expect(container.querySelector('[data-feedback-cta-state="collapsed"]')).toBeInTheDocument();
    expect(container.querySelector('[data-feedback-cta-state="collapsed"] aside')).toHaveClass('-translate-x-[calc(100%+16px)]');
    expect(container.querySelector('[data-sidebar-avatar-notification]')).toBeInTheDocument();
    expect(screen.queryByLabelText('Feedback')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Share feedback' })).not.toBeInTheDocument();
  });

  test('restores full feedback calls to action after the sidebar expands', async () => {
    const user = userEvent.setup();
    localStorage.setItem('veno-sidebar-collapsed', 'true');

    const { container } = render(
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

    expect(container.querySelector('a[href="https://forms.example.test"]')).toBeInTheDocument();
    expect(container.querySelector('[data-feedback-cta-state="collapsed"]')).toBeInTheDocument();
    expect(container.querySelector('[data-sidebar-avatar-notification]')).toBeInTheDocument();
    expect(screen.queryByLabelText('Feedback')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand sidebar navigation' }));

    expect(container.querySelector('[data-feedback-cta-state="expanded"]')).toBeInTheDocument();
    expect(container.querySelector('[data-sidebar-avatar-notification]')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Feedback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Share feedback' })).toBeInTheDocument();
  });
});
