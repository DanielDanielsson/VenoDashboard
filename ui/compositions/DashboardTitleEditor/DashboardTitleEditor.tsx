'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ui/base/Button';
import { useNotifications } from '@ui/compositions/NotificationsProvider';

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export function DashboardTitleEditor({
  dashboardUid,
  initialTitle,
  dashboardVersion,
  isOwner,
  showActions = true,
}: {
  dashboardUid: string;
  initialTitle: string;
  dashboardVersion: number | null;
  isOwner: boolean;
  showActions?: boolean;
}) {
  const router = useRouter();
  const { notifyError, notifySuccess } = useNotifications();
  const [title, setTitle] = useState(initialTitle);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [version, setVersion] = useState(dashboardVersion);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function saveTitle() {
    const normalizedTitle = draftTitle.trim();
    if (!normalizedTitle) {
      notifyError('Dashboard title is required');
      return;
    }

    if (!version) {
      notifyError('Dashboard could not be renamed', {
        message: 'Dashboard version is required.',
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/dashboard/dashboards/${encodeURIComponent(dashboardUid)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: normalizedTitle,
          description: null,
          expectedVersion: version,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard could not be renamed'));
      }

      const payload = await response.json() as {
        dashboard?: {
          title?: string;
          version?: number;
        };
      };

      setTitle(payload.dashboard?.title ?? normalizedTitle);
      setDraftTitle(payload.dashboard?.title ?? normalizedTitle);
      setVersion(payload.dashboard?.version ?? version + 1);
      setIsEditing(false);
      notifySuccess('Dashboard renamed');
      router.refresh();
    } catch (error) {
      notifyError('Dashboard could not be renamed', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDashboard() {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/dashboard/dashboards/${encodeURIComponent(dashboardUid)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard could not be deleted'));
      }

      notifySuccess('Dashboard deleted');
      router.push('/dashboards');
    } catch (error) {
      notifyError('Dashboard could not be deleted', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <h1 className="page_title text-text">{title}</h1>
      {isOwner && showActions ? (
        <div className="flex flex-wrap items-end gap-3">
          {isEditing ? (
            <>
              <label className="grid gap-2">
                <span className="ui_micro_label text-text-soft">Dashboard title</span>
                <input
                  className="body_text rounded-[5px] border border-border bg-bg px-3 py-2 text-text"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                />
              </label>
              <Button
                ariaLabel="Save title"
                disabled={isSaving}
                twStyles="ui_button_text rounded-[5px] border border-border px-3 py-2 text-text-soft transition-colors hover:border-text-soft hover:text-text"
                onClick={saveTitle}
              >
                {isSaving ? 'Saving' : 'Save title'}
              </Button>
            </>
          ) : (
            <>
              <Button
                ariaLabel="Edit dashboard"
                twStyles="ui_button_text rounded-[5px] border border-border px-3 py-2 text-text-soft transition-colors hover:border-text-soft hover:text-text"
                onClick={() => setIsEditing(true)}
              >
                Edit dashboard
              </Button>
              <Button
                ariaLabel="Delete dashboard"
                disabled={isDeleting}
                twStyles="ui_button_text rounded-[5px] border border-border px-3 py-2 text-text-soft transition-colors hover:border-text-soft hover:text-text"
                onClick={deleteDashboard}
              >
                {isDeleting ? 'Deleting' : 'Delete dashboard'}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
