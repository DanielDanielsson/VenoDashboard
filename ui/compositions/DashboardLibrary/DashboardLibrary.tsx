'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { Link } from '@ui/base/Link';
import { DropdownMenu, type DropdownMenuOption } from '@ui/components/DropdownMenu';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';

const DASHBOARD_TYPE_LABEL: Record<DashboardLibraryItem['type'], string> = {
  live: 'Live',
  timeRange: 'Time range',
};

const DASHBOARD_TYPE_OPTIONS = [
  { value: 'live', label: 'Live' },
  { value: 'timeRange', label: 'Time range' },
] as const satisfies readonly DropdownMenuOption<DashboardLibraryItem['type']>[];

const DASHBOARD_LIBRARY_COLUMNS = {
  owner: 'md:grid-cols-[minmax(0,1.4fr)_10rem_minmax(10rem,0.9fr)_12rem]',
  public: 'md:grid-cols-[minmax(0,1.4fr)_10rem_minmax(10rem,0.9fr)]',
};

interface DashboardLibraryProps {
  dashboards: DashboardLibraryItem[];
  isOwner: boolean;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export function DashboardLibrary({ dashboards, isOwner }: DashboardLibraryProps) {
  const [items, setItems] = useState(dashboards);
  const [savingDashboardUid, setSavingDashboardUid] = useState<string | null>(null);
  const dashboardLibraryColumns = isOwner ? DASHBOARD_LIBRARY_COLUMNS.owner : DASHBOARD_LIBRARY_COLUMNS.public;

  const homeDashboardUid = useMemo(
    () => items.find((dashboard) => dashboard.isHome)?.uid ?? items[0]?.uid ?? 'overview',
    [items],
  );
  const pinnedDashboardUids = useMemo(
    () => items.filter((dashboard) => dashboard.isPinned).map((dashboard) => dashboard.uid),
    [items],
  );

  return (
    <div className="grid gap-4">
      {isOwner ? <DashboardCreateForm /> : null}
      <div
        className={`hidden rounded-[4px] border border-dashboard-panel-border bg-dashboard-panel-header-bg md:grid md:items-center ${dashboardLibraryColumns}`}
        data-testid="dashboard-library-header"
      >
        <span className="body_text px-4 py-2 text-text-soft">Name</span>
        <span className="body_text px-4 py-2 text-text-soft">Type</span>
        <span className="body_text px-4 py-2 text-text-soft">Tag</span>
        {isOwner ? <span aria-hidden="true" /> : null}
      </div>
      <ul aria-label="Dashboards" className="grid gap-2">
        {items.map((dashboard) => (
          <li
            key={dashboard.uid}
            className="overflow-hidden rounded-[6px] border border-dashboard-panel-border bg-dashboard-panel-bg shadow-sm transition-colors hover:border-text-soft"
          >
            <article className={`relative grid min-h-[4.5rem] ${dashboardLibraryColumns}`}>
              <Link
                ariaLabel={`Open ${dashboard.title} dashboard`}
                href={`/dashboards/${dashboard.uid}`}
                twStyles={`absolute inset-y-0 left-0 z-0 hidden transition-colors hover:bg-dashboard-time-picker-bg-hover md:block ${isOwner ? 'right-[12rem]' : 'right-0'}`}
              >
                <span className="sr-only">Open {dashboard.title} dashboard</span>
              </Link>
              <span className="panel_title pointer-events-none z-[1] min-w-0 truncate p-4 text-dashboard-panel-title">
                {dashboard.title}
              </span>
              <span className="pointer-events-none z-[1] flex items-center p-4">
                <DashboardLibraryBadge>{DASHBOARD_TYPE_LABEL[dashboard.type]}</DashboardLibraryBadge>
              </span>
              <span className="pointer-events-none z-[1] flex flex-wrap items-center gap-2 p-4">
                {dashboard.isHome ? (
                  <DashboardLibraryBadge tone="success">Home</DashboardLibraryBadge>
                ) : null}
                {dashboard.isPinned ? (
                  <DashboardLibraryBadge>Pinned</DashboardLibraryBadge>
                ) : null}
              </span>

              {isOwner ? (
                <div className="z-[2] flex flex-nowrap justify-end gap-2 px-4 pb-4 md:items-center md:px-0 md:py-3 md:pr-4">
                  <DashboardPinButton
                    dashboard={dashboard}
                    homeDashboardUid={homeDashboardUid}
                    pinnedDashboardUids={pinnedDashboardUids}
                    isSaving={savingDashboardUid === dashboard.uid}
                    setSavingDashboardUid={setSavingDashboardUid}
                    setItems={setItems}
                  />
                  <DashboardDeleteButton dashboard={dashboard} setItems={setItems} />
                </div>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardLibraryBadge({
  children,
  tone = 'muted',
}: {
  children: string;
  tone?: 'muted' | 'success';
}) {
  const toneClass = tone === 'success'
    ? 'border-success text-success'
    : 'border-border text-text-soft';

  return (
    <span className={`ui_micro_label rounded-[4px] border px-2 py-1 ${toneClass}`}>
      {children}
    </span>
  );
}

function DashboardCreateForm() {
  const router = useRouter();
  const { notifyError, notifySuccess } = useNotifications();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DashboardLibraryItem['type'] | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  async function createDashboard() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      notifyError('Dashboard title is required');
      return;
    }

    if (!type) {
      notifyError('Dashboard type is required');
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
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-end">
        <label className="grid gap-2">
          <span className="ui_micro_label text-text-soft">Dashboard title</span>
          <input
            className="body_text rounded-[5px] border border-border bg-bg px-3 py-2 text-text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <DropdownMenu
          label="Dashboard type"
          placeholder="Select type"
          value={type}
          options={DASHBOARD_TYPE_OPTIONS}
          onChange={(nextType) => setType(nextType)}
        />
        <Button
          ariaLabel="Create dashboard"
          disabled={isSaving}
          twStyles="ui_button_text rounded-[5px] border border-border px-3 py-2 text-text-soft transition-colors hover:border-text-soft hover:text-text"
          onClick={createDashboard}
        >
          {isSaving ? 'Creating' : 'Create dashboard'}
        </Button>
      </div>
    </section>
  );
}

function DashboardPinButton({
  dashboard,
  homeDashboardUid,
  pinnedDashboardUids,
  isSaving,
  setSavingDashboardUid,
  setItems,
}: {
  dashboard: DashboardLibraryItem;
  homeDashboardUid: string;
  pinnedDashboardUids: string[];
  isSaving: boolean;
  setSavingDashboardUid: (dashboardUid: string | null) => void;
  setItems: Dispatch<SetStateAction<DashboardLibraryItem[]>>;
}) {
  const router = useRouter();
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
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, errorTitle));
      }

      const payload = await response.json() as {
        preferences?: {
          pinnedDashboardUids?: string[];
        };
      };
      const savedPinnedDashboardUids = new Set(payload.preferences?.pinnedDashboardUids ?? nextPinnedDashboardUids);
      setItems((currentItems) => currentItems.map((item) => ({
        ...item,
        isPinned: savedPinnedDashboardUids.has(item.uid),
      })));
      notifySuccess(successTitle);
      router.refresh();
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
      twStyles="grid h-10 w-10 place-items-center rounded-[5px] border border-border text-text-soft transition-colors hover:border-text-soft hover:text-text"
      onClick={() => savePinnedState(!dashboard.isPinned)}
    >
      <Icon icon={dashboard.isPinned ? 'bookmark-filled' : 'bookmark'} twStyles="h-5 w-5" />
    </Button>
  );
}

function DashboardDeleteButton({
  dashboard,
  setItems,
}: {
  dashboard: DashboardLibraryItem;
  setItems: Dispatch<SetStateAction<DashboardLibraryItem[]>>;
}) {
  const router = useRouter();
  const { notifyError, notifySuccess } = useNotifications();
  const [isDeleting, setIsDeleting] = useState(false);

  async function deleteDashboard() {
    if (dashboard.isHome) {
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

  return (
    <Button
      ariaLabel={`Delete ${dashboard.title}`}
      disabled={dashboard.isHome || isDeleting}
      twStyles="ui_button_text rounded-[5px] border border-border px-3 py-2 text-text-soft transition-colors hover:border-text-soft hover:text-text"
      onClick={deleteDashboard}
    >
      {isDeleting ? 'Deleting' : 'Delete'}
    </Button>
  );
}
