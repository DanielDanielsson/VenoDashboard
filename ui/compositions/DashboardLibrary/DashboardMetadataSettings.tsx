'use client';

import { useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { DashboardTimeRangePicker } from '@ui/components/DashboardTimeRangePicker';
import { SecondaryButton } from '@ui/components/SecondaryButton';
import { TextInput } from '@ui/components/TextInput';
import {
  WysiwygEditor,
  type WysiwygDocument,
} from '@ui/components/WysiwygEditor';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import { DASHBOARD_ICON_OPTIONS } from '@/lib/dashboard/metadata';
import type { HistorySelection } from '@/lib/glucose/history-cache';
import {
  applyDashboardMetadataSaveResult,
  isDashboardMetadataDirty,
  normalizeDashboardDescriptionDraft,
  serializeDashboardDescription,
} from './utils';
import type { DashboardMetadataSaveResult } from './types';

interface DashboardMetadataSettingsProps {
  dashboard: DashboardLibraryItem;
  isOwner: boolean;
  onDirtyChange: (dashboardUid: string, isDirty: boolean) => void;
  onDeleted: (dashboardUid: string) => void;
  onSaved: (previousUid: string, nextUid: string) => void;
  setItems: Dispatch<SetStateAction<DashboardLibraryItem[]>>;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export function DashboardMetadataSettings({
  dashboard,
  isOwner,
  onDirtyChange,
  onDeleted,
  onSaved,
  setItems,
}: DashboardMetadataSettingsProps) {
  const router = useRouter();
  const { notifyError, notifySuccess } = useNotifications();
  const [draftTitle, setDraftTitle] = useState(dashboard.title);
  const [draftDescription, setDraftDescription] = useState<WysiwygDocument>(
    normalizeDashboardDescriptionDraft(dashboard.description),
  );
  const [draftIcon, setDraftIcon] = useState<DashboardLibraryItem['icon']>(
    dashboard.icon ?? 'dashboard-grid',
  );
  const [draftDefaultTimeRange, setDraftDefaultTimeRange] = useState<DashboardLibraryItem['defaultTimeRange']>(
    dashboard.defaultTimeRange ?? (dashboard.type === 'timeRange' ? '3d' : null),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const isDirty = isDashboardMetadataDirty({
    dashboard,
    draftTitle,
    draftDescription,
    draftIcon,
    draftDefaultTimeRange,
  });

  useEffect(() => {
    setDraftTitle(dashboard.title);
    setDraftDescription(normalizeDashboardDescriptionDraft(dashboard.description));
    setDraftIcon(dashboard.icon ?? 'dashboard-grid');
    setDraftDefaultTimeRange(dashboard.defaultTimeRange ?? (dashboard.type === 'timeRange' ? '3d' : null));
  }, [dashboard.defaultTimeRange, dashboard.description, dashboard.icon, dashboard.title, dashboard.type, dashboard.uid]);

  useLayoutEffect(() => {
    onDirtyChange(dashboard.uid, isDirty);
  }, [dashboard.uid, isDirty, onDirtyChange]);

  async function saveDashboardSettings() {
    if (!isOwner) {
      notifyError('Sign in to save dashboard settings');
      return;
    }

    const normalizedTitle = draftTitle.trim();
    if (!normalizedTitle) {
      notifyError('Dashboard name is required');
      return;
    }

    if (!dashboard.version) {
      notifyError('Dashboard settings could not be saved', {
        message: 'Dashboard version is required.',
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/dashboard/dashboards/${encodeURIComponent(dashboard.uid)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: normalizedTitle,
          description: serializeDashboardDescription(draftDescription),
          icon: draftIcon ?? 'dashboard-grid',
          defaultTimeRange: dashboard.type === 'timeRange' ? draftDefaultTimeRange ?? '3d' : null,
          expectedVersion: dashboard.version,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard settings could not be saved'));
      }

      const payload = await response.json() as DashboardMetadataSaveResult;
      setItems((currentItems) => applyDashboardMetadataSaveResult(currentItems, dashboard.uid, payload));
      onSaved(dashboard.uid, payload.dashboard?.uid ?? dashboard.uid);
      notifySuccess('Dashboard settings saved');
      router.refresh();
    } catch (error) {
      notifyError('Dashboard settings could not be saved', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDashboard() {
    if (!isOwner) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/dashboard/dashboards/${encodeURIComponent(dashboard.uid)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard could not be deleted'));
      }

      setItems((currentItems) => currentItems.filter((item) => item.uid !== dashboard.uid));
      onDeleted(dashboard.uid);
      notifySuccess('Dashboard deleted');
      router.refresh();
    } catch (error) {
      notifyError('Dashboard could not be deleted', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function duplicateDashboard() {
    if (!isOwner) {
      notifyError('Sign in to duplicate dashboards');
      return;
    }

    setIsDuplicating(true);

    try {
      const response = await fetch(`/api/dashboard/dashboards/${encodeURIComponent(dashboard.uid)}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard could not be duplicated'));
      }

      const payload = await response.json() as {
        dashboard?: {
          uid?: string;
          title?: string;
          description?: DashboardLibraryItem['description'];
          icon?: DashboardLibraryItem['icon'];
          defaultTimeRange?: DashboardLibraryItem['defaultTimeRange'];
          type?: DashboardLibraryItem['type'];
          version?: number;
          updatedAt?: string | null;
        };
      };
      const duplicatedDashboard = payload.dashboard;
      if (!duplicatedDashboard?.uid || !duplicatedDashboard.title || !duplicatedDashboard.type) {
        throw new Error('Duplicated dashboard response did not include a dashboard.');
      }

      const duplicatedItem: DashboardLibraryItem = {
        uid: duplicatedDashboard.uid,
        title: duplicatedDashboard.title,
        description: duplicatedDashboard.description ?? null,
        icon: duplicatedDashboard.icon ?? 'dashboard-grid',
        defaultTimeRange: duplicatedDashboard.defaultTimeRange ?? (duplicatedDashboard.type === 'timeRange' ? '3d' : null),
        type: duplicatedDashboard.type,
        version: duplicatedDashboard.version ?? null,
        updatedAt: duplicatedDashboard.updatedAt ?? null,
        isHome: false,
        isPinned: false,
      };

      setItems((currentItems) => {
        const withoutExistingDuplicate = currentItems.filter((item) => item.uid !== duplicatedItem.uid);
        const sourceIndex = withoutExistingDuplicate.findIndex((item) => item.uid === dashboard.uid);

        if (sourceIndex === -1) {
          return [duplicatedItem, ...withoutExistingDuplicate];
        }

        return [
          ...withoutExistingDuplicate.slice(0, sourceIndex + 1),
          duplicatedItem,
          ...withoutExistingDuplicate.slice(sourceIndex + 1),
        ];
      });
      notifySuccess('Dashboard duplicated');
      router.refresh();
    } catch (error) {
      notifyError('Dashboard could not be duplicated', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDuplicating(false);
    }
  }

  function handleDefaultTimeRangeChange(selection: HistorySelection) {
    if (selection.kind === 'preset') {
      setDraftDefaultTimeRange(selection.range);
    }
  }

  return (
    <section
      aria-label={`${dashboard.title} settings`}
      className="grid gap-6 border-t border-dashboard-panel-border bg-dashboard-panel-header-bg p-5"
    >
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          <TextInput
            label="Dashboard name"
            value={draftTitle}
            onChange={setDraftTitle}
          />
          <WysiwygEditor
            label="Description"
            value={draftDescription}
            onChange={setDraftDescription}
          />
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <span className="ui_micro_label text-text-soft">Icon</span>
            <div className="grid grid-cols-3 gap-2 xl:grid-cols-4">
              {DASHBOARD_ICON_OPTIONS.map((option) => {
                const isSelected = draftIcon === option.value;

                return (
                  <Button
                    ariaLabel={option.label}
                    aria-pressed={isSelected}
                    key={option.value}
                    title={option.label}
                    twStyles={twMerge(
                      'grid h-12 place-items-center rounded-[5px] border border-dashboard-time-picker-border bg-dashboard-time-picker-bg text-dashboard-time-picker-text-muted transition-colors hover:border-text-soft hover:bg-dashboard-time-picker-bg-hover hover:text-dashboard-time-picker-text',
                      isSelected && 'border-accent bg-accent-soft text-accent hover:border-accent hover:text-accent',
                    )}
                    onClick={() => setDraftIcon(option.value)}
                  >
                    <Icon icon={option.value} twStyles="h-5 w-5" />
                  </Button>
                );
              })}
            </div>
          </div>
          {dashboard.type === 'timeRange' ? (
            <div className="grid gap-2">
              <span className="ui_micro_label text-text-soft">Default time range</span>
              <DashboardTimeRangePicker
                selection={{ kind: 'preset', range: draftDefaultTimeRange ?? '3d' }}
                currentWindow={null}
                timeZone="UTC"
                presetOnly
                onChange={handleDefaultTimeRangeChange}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashboard-panel-border pt-5">
        {!isOwner ? (
          <p className="ui_caption text-text-soft">Sign in to save dashboard settings.</p>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {isOwner ? (
            <>
              <SecondaryButton
                aria-label={`Duplicate ${dashboard.title}`}
                disabled={isDuplicating}
                twStyles="inline-flex items-center gap-2"
                onClick={duplicateDashboard}
              >
                <Icon icon="dashboard-grid" twStyles="h-4 w-4" />
                {isDuplicating ? 'Duplicating' : 'Duplicate'}
              </SecondaryButton>
              <SecondaryButton
                aria-label={`Delete ${dashboard.title}`}
                disabled={isDeleting}
                twStyles="inline-flex items-center gap-2 border-error/40 text-error"
                onClick={deleteDashboard}
              >
                <Icon icon="trash" twStyles="h-4 w-4" />
                {isDeleting ? 'Deleting' : 'Delete'}
              </SecondaryButton>
            </>
          ) : null}
          <Button
            ariaLabel="Save dashboard settings"
            disabled={isSaving}
            twStyles="ui_caption_strong rounded-[4px] bg-accent px-4 py-2 text-base-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            onClick={saveDashboardSettings}
          >
            {isSaving ? 'Saving' : 'Save settings'}
          </Button>
        </div>
      </div>
    </section>
  );
}
