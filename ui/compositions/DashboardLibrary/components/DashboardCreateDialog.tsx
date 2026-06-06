'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ui/base/Button';
import { DialogPanel } from '@ui/components/DialogPanel';
import { SecondaryButton } from '@ui/components/SecondaryButton';
import {
  createWysiwygDocument,
  type WysiwygDocument,
} from '@ui/components/WysiwygEditor';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import { DashboardSettingsForm } from '../DashboardSettingsForm';
import { serializeDashboardDescription } from '../utils';

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
};

interface DashboardCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardCreateDialog = ({
  isOpen,
  onClose,
}: DashboardCreateDialogProps) => {
  const router = useRouter();
  const { notifyError, notifySuccess } = useNotifications();
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState<WysiwygDocument>(() => createWysiwygDocument());
  const [draftIcon, setDraftIcon] = useState<DashboardLibraryItem['icon']>('dashboard-grid');
  const [draftDefaultTimeRange, setDraftDefaultTimeRange] = useState<DashboardLibraryItem['defaultTimeRange']>('3d');
  const [draftType, setDraftType] = useState<DashboardLibraryItem['type']>('timeRange');
  const [isSaving, setIsSaving] = useState(false);

  const resetDraft = () => {
    setDraftTitle('');
    setDraftDescription(createWysiwygDocument());
    setDraftIcon('dashboard-grid');
    setDraftDefaultTimeRange('3d');
    setDraftType('timeRange');
  };

  const closeDialog = () => {
    if (isSaving) {
      return;
    }

    resetDraft();
    onClose();
  };

  const updateDashboardType = (dashboardType: DashboardLibraryItem['type']) => {
    setDraftType(dashboardType);
    setDraftDefaultTimeRange((currentRange) => (
      dashboardType === 'timeRange' ? currentRange ?? '3d' : null
    ));
  };

  const createDashboard = async () => {
    const normalizedTitle = draftTitle.trim();
    if (!normalizedTitle) {
      notifyError('Dashboard name is required');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/dashboard/dashboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: normalizedTitle,
          description: serializeDashboardDescription(draftDescription),
          icon: draftIcon ?? 'dashboard-grid',
          defaultTimeRange: draftType === 'timeRange' ? draftDefaultTimeRange ?? '3d' : null,
          type: draftType,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard could not be created'));
      }

      const payload = await response.json() as {
        dashboard?: {
          uid?: string;
        };
      };
      const dashboardUid = payload.dashboard?.uid;
      if (!dashboardUid) {
        throw new Error('Created dashboard response did not include a dashboard uid.');
      }

      notifySuccess('Dashboard created');
      resetDraft();
      onClose();
      router.push(`/dashboards/${dashboardUid}`);
    } catch (error) {
      notifyError('Dashboard could not be created', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <DialogPanel
      title="Create Dashboard"
      widthClassName="w-[min(62rem,calc(100%-2rem))]"
      contentClassName="p-0"
    >
      <DashboardSettingsForm
        ariaLabel="New dashboard settings"
        title={draftTitle}
        description={draftDescription}
        icon={draftIcon}
        defaultTimeRange={draftDefaultTimeRange}
        dashboardType={draftType}
        twStyles="bg-dashboard-panel-bg"
        onTitleChange={setDraftTitle}
        onDescriptionChange={setDraftDescription}
        onIconChange={setDraftIcon}
        onDefaultTimeRangeChange={setDraftDefaultTimeRange}
        onDashboardTypeChange={updateDashboardType}
      >
        <span aria-hidden="true" />
        <div className="flex flex-wrap justify-end gap-2">
          <SecondaryButton
            aria-label="Cancel dashboard creation"
            disabled={isSaving}
            onClick={closeDialog}
          >
            Cancel
          </SecondaryButton>
          <Button
            ariaLabel="Create dashboard"
            disabled={isSaving}
            twStyles="ui_caption_strong rounded-[4px] bg-accent px-4 py-2 text-base-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            onClick={createDashboard}
          >
            {isSaving ? 'Creating' : 'Create Dashboard'}
          </Button>
        </div>
      </DashboardSettingsForm>
    </DialogPanel>
  );
};
