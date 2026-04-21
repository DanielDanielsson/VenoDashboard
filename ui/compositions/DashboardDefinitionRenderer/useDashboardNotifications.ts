'use client';

import { useNotifications } from '@ui/compositions/NotificationsProvider';

interface DashboardNotificationOptions {
  dashboardUid: string;
}

export function useDashboardNotifications({ dashboardUid }: DashboardNotificationOptions) {
  void dashboardUid;
  const { notifyError, notifySuccess } = useNotifications();

  return {
    notifyDashboardSaveRequiresAdmin() {
      notifyError('Admin sign in required', {
        message: 'Sign in with admin access before saving dashboard changes.',
      });
    },
    notifyDashboardSaved() {
      notifySuccess('Dashboard changes saved');
    },
    notifyDashboardSaveFailed(message?: string) {
      notifyError('Dashboard changes could not be saved', {
        message: message || 'Failed to save dashboard settings.',
      });
    },
  };
}
