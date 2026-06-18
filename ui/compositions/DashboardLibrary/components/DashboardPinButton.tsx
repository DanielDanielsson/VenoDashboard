'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
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

export const DashboardPinButton = ({
  dashboard,
  homeDashboardUid,
  pinnedDashboardUids,
  dashboardOrderUids,
  isSaving,
  setSavingDashboardUid,
  setItems,
}: {
  dashboard: DashboardLibraryItem;
  homeDashboardUid: string | null;
  pinnedDashboardUids: string[];
  dashboardOrderUids: string[];
  isSaving: boolean;
  setSavingDashboardUid: (dashboardUid: string | null) => void;
  setItems: Dispatch<SetStateAction<DashboardLibraryItem[]>>;
}) => {
  const { notifySuccess, notifyError } = useNotifications();

  async function savePinnedState(isPinned: boolean) {
    const nextPinnedDashboardUids = isPinned
      ? [...pinnedDashboardUids, dashboard.uid]
      : pinnedDashboardUids.filter((dashboardUid) => dashboardUid !== dashboard.uid);
    const successTitle = isPinned ? 'Dashboard pinned' : 'Dashboard unpinned';
    const errorTitle = isPinned ? 'Dashboard could not be pinned' : 'Dashboard could not be unpinned';

    setSavingDashboardUid(dashboard.uid);

    try {
      const response = await fetch('/api/dashboard/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          homeDashboardUid,
          pinnedDashboardUids: nextPinnedDashboardUids,
          dashboardOrderUids,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, errorTitle));
      }

      const payload = await response.json() as {
        preferences?: {
          homeDashboardUid?: string | null;
          pinnedDashboardUids?: string[];
          dashboardOrderUids?: string[];
        };
      };
      const savedHomeDashboardUid = payload.preferences?.homeDashboardUid ?? homeDashboardUid;
      const savedPinnedDashboardUids = new Set(payload.preferences?.pinnedDashboardUids ?? nextPinnedDashboardUids);
      runPreservingWindowScroll(() => {
        setItems((currentItems) => currentItems.map((item) => ({
          ...item,
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
      notifySuccess(successTitle);
    } catch (error) {
      notifyError(errorTitle, {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingDashboardUid(null);
    }
  }

  return (
    <Button
      ariaLabel={`${dashboard.isPinned ? 'Unpin' : 'Pin'} ${dashboard.title}`}
      disabled={isSaving}
      title={`${dashboard.isPinned ? 'Unpin' : 'Pin'} ${dashboard.title}`}
      twStyles="grid h-10 w-10 shrink-0 place-items-center rounded-[5px] border border-border text-text-soft transition-colors hover:border-text-soft hover:text-text"
      onClick={() => savePinnedState(!dashboard.isPinned)}
    >
      <Icon icon={dashboard.isPinned ? 'bookmark-filled' : 'bookmark'} twStyles="h-5 w-5" />
    </Button>
  );
};
