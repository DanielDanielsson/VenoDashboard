// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { useDashboardNotifications } from './useDashboardNotifications';

const TriggerDashboardNotifications = () => {
  const {
    notifyDashboardSaveFailed,
    notifyDashboardSaveRequiresAdmin,
    notifyDashboardSaved,
  } = useDashboardNotifications({
    dashboardUid: 'statistics',
  });

  return (
    <>
      <button type="button" onClick={() => notifyDashboardSaved()}>
        Show saved
      </button>
      <button type="button" onClick={() => notifyDashboardSaveFailed('Version conflict while saving dashboard')}>
        Show failed
      </button>
      <button type="button" onClick={() => notifyDashboardSaveRequiresAdmin()}>
        Show access required
      </button>
    </>
  );
};

describe('useDashboardNotifications', () => {
  test('shows a new toast for each dashboard save', () => {
    render(
      <NotificationsProvider>
        <TriggerDashboardNotifications />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show saved' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show saved' }));

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getAllByText('Dashboard changes saved')).toHaveLength(2);
    expect(within(viewport).getAllByRole('article')).toHaveLength(2);
  });

  test('shows an error toast when admin access is required to save', () => {
    render(
      <NotificationsProvider>
        <TriggerDashboardNotifications />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show access required' }));

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getByText('Admin sign in required').closest('[data-variant="error"]')).toBeInTheDocument();
    expect(within(viewport).getByText('Sign in with admin access before saving dashboard changes.')).toBeInTheDocument();
  });
});
