'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';

const DASHBOARD_TYPE_OPTIONS = [
  { value: 'live', label: 'Live', icon: 'glucose' },
  { value: 'timeRange', label: 'Time range', icon: 'clock' },
] as const satisfies readonly {
  value: DashboardLibraryItem['type'];
  label: string;
  icon: 'glucose' | 'clock';
}[];

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
};

export const DashboardCreateForm = () => {
  const router = useRouter();
  const { notifyError, notifySuccess } = useNotifications();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DashboardLibraryItem['type']>('timeRange');
  const [isSaving, setIsSaving] = useState(false);

  async function createDashboard() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      notifyError('Dashboard title is required');
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
          type,
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
      router.push(`/dashboards/${dashboardUid}`);
    } catch (error) {
      notifyError('Dashboard could not be created', {
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-[6px] border border-dashboard-panel-border bg-dashboard-panel-bg p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem_auto] md:items-end">
        <label className="grid gap-2">
          <span className="ui_micro_label text-text-soft">Dashboard title</span>
          <input
            className="body_text rounded-[5px] border border-border bg-bg px-3 py-2 text-text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <fieldset className="grid gap-2">
          <legend className="ui_micro_label text-text-soft">Dashboard type</legend>
          <div className="grid grid-cols-2 gap-2">
            {DASHBOARD_TYPE_OPTIONS.map((option) => {
              const isSelected = type === option.value;

              return (
                <Button
                  ariaLabel={`Select ${option.label} dashboard type`}
                  aria-pressed={isSelected}
                  key={option.value}
                  twStyles={twMerge(
                    'grid min-h-20 place-items-center gap-1 rounded-[5px] border px-3 py-3 transition-colors',
                    isSelected
                      ? 'border-text-soft bg-dashboard-time-picker-bg-hover text-dashboard-time-picker-text'
                      : 'border-border text-text-soft hover:border-text-soft hover:text-text',
                  )}
                  onClick={() => setType(option.value)}
                >
                  <Icon icon={option.icon} twStyles="h-6 w-6" />
                  <span className="ui_caption text-center">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </fieldset>
        <Button
          ariaLabel="Create dashboard"
          disabled={isSaving}
          twStyles="ui_button_text rounded-[5px] border border-border px-3 py-2 text-text-soft transition-colors hover:border-text-soft hover:text-text md:min-h-20"
          onClick={createDashboard}
        >
          {isSaving ? 'Creating' : 'Create dashboard'}
        </Button>
      </div>
    </section>
  );
};
