'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import { DialogPanel } from '@ui/components/DialogPanel';
import { SecondaryButton } from '@ui/components/SecondaryButton';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import {
  dispatchDashboardPreferencesUpdated,
  runPreservingWindowScroll,
} from '../utils';

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
};

export const DashboardHomeConfirmationDialog = ({
  dashboard,
  dashboardOrderUids,
  pinnedDashboardUids,
  onCancel,
  onSaved,
  setItems,
  setSavingDashboardUid,
}: {
  dashboard: DashboardLibraryItem;
  dashboardOrderUids: string[];
  pinnedDashboardUids: string[];
  onCancel: () => void;
  onSaved: () => void;
  setItems: Dispatch<SetStateAction<DashboardLibraryItem[]>>;
  setSavingDashboardUid: (dashboardUid: string | null) => void;
}) => {
  const { notifySuccess, notifyError } = useNotifications();

  async function saveHomeDashboard() {
    setSavingDashboardUid(dashboard.uid);

    try {
      const response = await fetch('/api/dashboard/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          homeDashboardUid: dashboard.uid,
          pinnedDashboardUids,
          dashboardOrderUids,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard could not be set as home'));
      }

      const payload = await response.json() as {
        preferences?: {
          homeDashboardUid?: string | null;
          pinnedDashboardUids?: string[];
          dashboardOrderUids?: string[];
        };
      };
      const savedHomeDashboardUid = payload.preferences?.homeDashboardUid ?? dashboard.uid;
      const savedPinnedDashboardUids = new Set(payload.preferences?.pinnedDashboardUids ?? pinnedDashboardUids);

      runPreservingWindowScroll(() => {
        setItems((currentItems) => currentItems.map((item) => ({
          ...item,
          isHome: item.uid === savedHomeDashboardUid,
          isPinned: savedPinnedDashboardUids.has(item.uid),
        })));
        dispatchDashboardPreferencesUpdated({
          homeDashboardUid: savedHomeDashboardUid,
          pinnedDashboardUids: Array.from(savedPinnedDashboardUids),
          dashboards: [{
            uid: dashboard.uid,
            title: dashboard.title,
            icon: dashboard.icon,
          }],
        });
      });
      notifySuccess('Home dashboard updated');
      onSaved();
    } catch (error) {
      notifyError('Dashboard could not be set as home', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingDashboardUid(null);
    }
  }

  return (
    <DialogPanel title="Set home dashboard?">
      <div className="flex flex-col gap-4">
        <p className="body_text text-text-soft">
          Set {dashboard.title} as the home dashboard? Only one dashboard can be home at a time.
        </p>
        <div className="flex justify-end gap-2">
          <SecondaryButton
            aria-label="Cancel home dashboard change"
            onClick={onCancel}
          >
            Cancel
          </SecondaryButton>
          <SecondaryButton
            aria-label={`Set ${dashboard.title} as home dashboard`}
            onClick={saveHomeDashboard}
          >
            Set as home
          </SecondaryButton>
        </div>
      </div>
    </DialogPanel>
  );
};
