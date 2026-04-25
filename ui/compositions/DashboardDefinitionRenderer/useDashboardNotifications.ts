'use client';

import { useMemo } from 'react';
import { useNotifications } from '@ui/compositions/NotificationsProvider';

interface DashboardNotificationOptions {
  dashboardUid: string;
}

export function useDashboardNotifications({ dashboardUid }: DashboardNotificationOptions) {
  void dashboardUid;
  const { notifyError, notifySuccess } = useNotifications();

  return useMemo(() => ({
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
    notifyInvalidDashboardUrl(dashboardTitle: string) {
      notifyError('Invalid URL parameter', {
        message: `Redirected to ${dashboardTitle}`,
      });
    },
  }), [notifyError, notifySuccess]);
}
