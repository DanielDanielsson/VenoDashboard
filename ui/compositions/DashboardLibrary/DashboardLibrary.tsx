'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { Link } from '@ui/base/Link';
import { DialogPanel } from '@ui/components/DialogPanel';
import { SecondaryButton } from '@ui/components/SecondaryButton';
import { useNotifications } from '@ui/compositions/NotificationsProvider';
import { getDashboardDescriptionText } from '@/lib/dashboard/metadata';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import { DashboardMetadataSettings } from './DashboardMetadataSettings';

const DASHBOARD_TYPE_LABEL: Record<DashboardLibraryItem['type'], string> = {
  live: 'Live',
  timeRange: 'Time range',
};

const DASHBOARD_TYPE_ICON: Record<DashboardLibraryItem['type'], 'glucose' | 'clock'> = {
  live: 'glucose',
  timeRange: 'clock',
};

const DASHBOARD_SETTINGS_PARAM = 'settings';

const DASHBOARD_TYPE_OPTIONS = [
  { value: 'live', label: 'Live', icon: 'glucose' },
  { value: 'timeRange', label: 'Time range', icon: 'clock' },
] as const satisfies readonly {
  value: DashboardLibraryItem['type'];
  label: string;
  icon: 'glucose' | 'clock';
}[];

const DASHBOARD_LIBRARY_COLUMNS = {
  owner: 'md:grid-cols-2',
  public: 'md:grid-cols-2',
};

const DASHBOARD_LIBRARY_DETAIL_COLUMNS = {
  owner: 'md:grid-cols-[10rem_minmax(0,1fr)_8.5rem]',
  public: 'md:grid-cols-[10rem_minmax(0,1fr)_4rem]',
};

const DASHBOARD_LIBRARY_LINK_RIGHT = {
  owner: 'right-[9.75rem]',
  public: 'right-[5.25rem]',
};

type PendingDirtyAction =
  | { type: 'collapse' }
  | { type: 'expand'; dashboardUid: string }
  | { type: 'navigate'; href: string };

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(dashboards);
  const [savingDashboardUid, setSavingDashboardUid] = useState<string | null>(null);
  const [expandedDashboardUid, setExpandedDashboardUid] = useState<string | null>(null);
  const [settingsDashboardUid, setSettingsDashboardUid] = useState<string | null>(
    () => searchParams.get(DASHBOARD_SETTINGS_PARAM),
  );
  const [dirtyDashboardUid, setDirtyDashboardUid] = useState<string | null>(null);
  const [pendingDirtyAction, setPendingDirtyAction] = useState<PendingDirtyAction | null>(null);
  const [pendingHomeDashboard, setPendingHomeDashboard] = useState<DashboardLibraryItem | null>(null);
  const dashboardRowRefs = useRef(new Map<string, HTMLLIElement>());
  const scrolledSettingsUidRef = useRef<string | null>(null);
  const dashboardLibraryColumns = isOwner ? DASHBOARD_LIBRARY_COLUMNS.owner : DASHBOARD_LIBRARY_COLUMNS.public;
  const dashboardLibraryDetailColumns = isOwner ? DASHBOARD_LIBRARY_DETAIL_COLUMNS.owner : DASHBOARD_LIBRARY_DETAIL_COLUMNS.public;
  const dashboardLinkRightClass = isOwner ? DASHBOARD_LIBRARY_LINK_RIGHT.owner : DASHBOARD_LIBRARY_LINK_RIGHT.public;

  const homeDashboardUid = useMemo(
    () => items.find((dashboard) => dashboard.isHome)?.uid ?? items[0]?.uid ?? '',
    [items],
  );
  const pinnedDashboardUids = useMemo(
    () => items.filter((dashboard) => dashboard.isPinned).map((dashboard) => dashboard.uid),
    [items],
  );
  const handleDirtyChange = useCallback((dashboardUid: string, isDirty: boolean) => {
    if (!isOwner) {
      return;
    }

    setDirtyDashboardUid((currentUid) => {
      if (isDirty) {
        return dashboardUid;
      }

      return currentUid === dashboardUid ? null : currentUid;
    });
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner || !dirtyDashboardUid) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyDashboardUid, isOwner]);

  useEffect(() => {
    setSettingsDashboardUid(searchParams.get(DASHBOARD_SETTINGS_PARAM));
  }, [searchParams]);

  useEffect(() => {
    if (!settingsDashboardUid) {
      setExpandedDashboardUid(null);
      scrolledSettingsUidRef.current = null;
      return;
    }

    const matchingDashboard = items.find((dashboard) => dashboard.uid === settingsDashboardUid);

    if (!matchingDashboard) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete(DASHBOARD_SETTINGS_PARAM);
      const nextSearch = nextParams.toString();
      window.history.replaceState(null, '', nextSearch ? `${pathname}?${nextSearch}` : pathname);
      setSettingsDashboardUid(null);
      setExpandedDashboardUid(null);
      scrolledSettingsUidRef.current = null;
      return;
    }

    setExpandedDashboardUid((currentUid) => (
      currentUid === matchingDashboard.uid ? currentUid : matchingDashboard.uid
    ));
  }, [items, pathname, searchParams, settingsDashboardUid]);

  useEffect(() => {
    if (!expandedDashboardUid || settingsDashboardUid !== expandedDashboardUid) {
      return;
    }

    if (scrolledSettingsUidRef.current === expandedDashboardUid) {
      return;
    }

    const dashboardRow = dashboardRowRefs.current.get(expandedDashboardUid);
    dashboardRow?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    scrolledSettingsUidRef.current = expandedDashboardUid;
  }, [expandedDashboardUid, settingsDashboardUid]);

  function updateSettingsUrl(dashboardUid: string | null, navigationMode: 'push' | 'replace' = 'push') {
    const nextParams = new URLSearchParams(window.location.search);

    if (dashboardUid) {
      nextParams.set(DASHBOARD_SETTINGS_PARAM, dashboardUid);
    } else {
      nextParams.delete(DASHBOARD_SETTINGS_PARAM);
    }

    const nextSearch = nextParams.toString();
    const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    const currentHref = `${window.location.pathname}${window.location.search}`;

    if (nextHref === currentHref) {
      setSettingsDashboardUid(dashboardUid);
      return;
    }

    if (navigationMode === 'replace') {
      window.history.replaceState(null, '', nextHref);
      setSettingsDashboardUid(dashboardUid);
      return;
    }

    window.history.pushState(null, '', nextHref);
    setSettingsDashboardUid(dashboardUid);
  }

  function setExpandedSettingsDashboardUid(
    dashboardUid: string | null,
    navigationMode: 'push' | 'replace' = 'push',
  ) {
    setExpandedDashboardUid(dashboardUid);
    updateSettingsUrl(dashboardUid, navigationMode);
  }

  function requestSettingsToggle(dashboardUid: string) {
    const nextAction: PendingDirtyAction = expandedDashboardUid === dashboardUid
      ? { type: 'collapse' }
      : { type: 'expand', dashboardUid };

    if (isOwner && dirtyDashboardUid) {
      setPendingDirtyAction(nextAction);
      return;
    }

    setExpandedSettingsDashboardUid(nextAction.type === 'expand' ? nextAction.dashboardUid : null);
  }

  function handleDashboardLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!isOwner || !dirtyDashboardUid) {
      return;
    }

    event.preventDefault();
    setPendingDirtyAction({ type: 'navigate', href });
  }

  function handleDiscardSettingsChanges() {
    const nextAction = pendingDirtyAction;
    setPendingDirtyAction(null);
    setDirtyDashboardUid(null);

    if (!nextAction) {
      return;
    }

    if (nextAction.type === 'navigate') {
      router.push(nextAction.href);
      return;
    }

    setExpandedSettingsDashboardUid(nextAction.type === 'expand' ? nextAction.dashboardUid : null);
  }

  return (
    <div className="relative grid gap-4">
      {isOwner ? <DashboardCreateForm /> : null}
      <div
        className={`hidden gap-6 rounded-[4px] border border-dashboard-panel-border bg-dashboard-panel-header-bg p-5 md:grid md:items-center ${dashboardLibraryColumns}`}
        data-testid="dashboard-library-header"
      >
        <span className="body_text text-text-soft">Name</span>
        <span className={`grid gap-6 ${dashboardLibraryDetailColumns}`}>
          <span className="body_text text-text-soft">Type</span>
          <span className="body_text text-text-soft">Tag</span>
          <span aria-hidden="true" />
        </span>
      </div>
      <ul aria-label="Dashboards" className="grid gap-2">
        {items.map((dashboard) => (
          <li
            key={dashboard.uid}
            ref={(node) => {
              if (node) {
                dashboardRowRefs.current.set(dashboard.uid, node);
                return;
              }

              dashboardRowRefs.current.delete(dashboard.uid);
            }}
            className="overflow-hidden rounded-[6px] border border-dashboard-panel-border bg-dashboard-panel-bg shadow-sm transition-colors hover:border-text-soft"
          >
            <article className={`relative grid min-h-[4.5rem] gap-6 p-5 ${dashboardLibraryColumns}`}>
              <Link
                ariaLabel={`Open ${dashboard.title} dashboard`}
                href={`/dashboards/${dashboard.uid}`}
                onClick={(event) => handleDashboardLinkClick(event, `/dashboards/${dashboard.uid}`)}
                twStyles={`absolute inset-y-0 left-0 z-0 hidden transition-colors hover:bg-dashboard-time-picker-bg-hover md:block ${dashboardLinkRightClass}`}
              >
                <span className="sr-only">Open {dashboard.title} dashboard</span>
              </Link>
              <span className="pointer-events-none z-[1] grid min-w-0 content-center gap-1">
                <span className="flex min-w-0 items-center gap-3">
                  <Icon
                    icon={dashboard.icon ?? 'dashboard-grid'}
                    twStyles="h-5 w-5 flex-none text-text-soft"
                  />
                  <span className="body_text min-w-0 truncate text-dashboard-panel-title">
                    {dashboard.title}
                  </span>
                </span>
                {getDashboardDescriptionText(dashboard.description) ? (
                  <span className="body_text overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] text-text-soft">
                    {getDashboardDescriptionText(dashboard.description)}
                  </span>
                ) : null}
              </span>
              <div className={`z-[1] grid min-w-0 gap-4 md:items-center md:gap-6 ${dashboardLibraryDetailColumns}`}>
                <span className="pointer-events-none flex items-center">
                  <DashboardLibraryBadge icon={DASHBOARD_TYPE_ICON[dashboard.type]}>
                    {DASHBOARD_TYPE_LABEL[dashboard.type]}
                  </DashboardLibraryBadge>
                </span>
                <span className="pointer-events-none flex flex-wrap items-center gap-2">
                  {dashboard.isHome ? (
                    <DashboardLibraryBadge tone="success">Home</DashboardLibraryBadge>
                  ) : null}
                  {dashboard.isPinned ? (
                    <DashboardLibraryBadge>Pinned</DashboardLibraryBadge>
                  ) : null}
                </span>

                <div className="z-[2] flex flex-nowrap justify-end gap-2 md:items-center">
                  {isOwner ? (
                    <>
                      <DashboardHomeButton
                        dashboard={dashboard}
                        isSaving={savingDashboardUid === dashboard.uid}
                        onRequestHomeDashboard={setPendingHomeDashboard}
                      />
                      <DashboardPinButton
                        dashboard={dashboard}
                        homeDashboardUid={homeDashboardUid}
                        pinnedDashboardUids={pinnedDashboardUids}
                        isSaving={savingDashboardUid === dashboard.uid}
                        setSavingDashboardUid={setSavingDashboardUid}
                        setItems={setItems}
                      />
                    </>
                  ) : null}
                  <Button
                    ariaLabel={`${expandedDashboardUid === dashboard.uid ? 'Close' : 'Open'} ${dashboard.title} settings`}
                    title={`${expandedDashboardUid === dashboard.uid ? 'Close' : 'Open'} ${dashboard.title} settings`}
                    twStyles="grid h-10 w-10 shrink-0 place-items-center rounded-[5px] border border-border text-text-soft transition-colors hover:border-text-soft hover:text-text"
                    onClick={() => requestSettingsToggle(dashboard.uid)}
                  >
                    <Icon icon="more-horizontal" twStyles="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </article>
            {expandedDashboardUid === dashboard.uid ? (
              <DashboardMetadataSettings
                dashboard={dashboard}
                isOwner={isOwner}
                onDeleted={(dashboardUid) => {
                  setExpandedDashboardUid((currentUid) => {
                    if (currentUid !== dashboardUid) {
                      return currentUid;
                    }

                    updateSettingsUrl(null, 'replace');
                    return null;
                  });
                  setDirtyDashboardUid((currentUid) => currentUid === dashboardUid ? null : currentUid);
                }}
                onDirtyChange={handleDirtyChange}
                onSaved={(previousUid, nextUid) => {
                  setExpandedDashboardUid((currentUid) => {
                    if (currentUid !== previousUid) {
                      return currentUid;
                    }

                    updateSettingsUrl(nextUid, 'replace');
                    return nextUid;
                  });
                  setDirtyDashboardUid((currentUid) => currentUid === previousUid ? null : currentUid);
                }}
                setItems={setItems}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {pendingDirtyAction ? (
        <DialogPanel title="Discard unsaved dashboard settings?">
          <div className="flex flex-col gap-4">
            <p className="body_text text-text-soft">
              Your unsaved dashboard settings will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <SecondaryButton
                aria-label="Keep editing"
                onClick={() => setPendingDirtyAction(null)}
              >
                Keep editing
              </SecondaryButton>
              <SecondaryButton
                aria-label="Discard settings changes"
                onClick={handleDiscardSettingsChanges}
              >
                Discard changes
              </SecondaryButton>
            </div>
          </div>
        </DialogPanel>
      ) : null}
      {pendingHomeDashboard ? (
        <DashboardHomeConfirmationDialog
          dashboard={pendingHomeDashboard}
          pinnedDashboardUids={pinnedDashboardUids}
          onCancel={() => setPendingHomeDashboard(null)}
          onSaved={() => setPendingHomeDashboard(null)}
          setItems={setItems}
          setSavingDashboardUid={setSavingDashboardUid}
        />
      ) : null}
    </div>
  );
}

function DashboardLibraryBadge({
  children,
  icon,
  tone = 'muted',
}: {
  children: string;
  icon?: 'glucose' | 'clock';
  tone?: 'muted' | 'success';
}) {
  const toneClass = tone === 'success'
    ? 'border-success text-success'
    : 'border-border text-text-soft';

  return (
    <span className={`ui_micro_label inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 ${toneClass}`}>
      {icon ? <Icon icon={icon} twStyles="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function DashboardCreateForm() {
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
                  twStyles={`grid min-h-20 place-items-center gap-1 rounded-[5px] border px-3 py-3 transition-colors ${
                    isSelected
                      ? 'border-text-soft bg-dashboard-time-picker-bg-hover text-dashboard-time-picker-text'
                      : 'border-border text-text-soft hover:border-text-soft hover:text-text'
                  }`}
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
}

function DashboardHomeButton({
  dashboard,
  isSaving,
  onRequestHomeDashboard,
}: {
  dashboard: DashboardLibraryItem;
  isSaving: boolean;
  onRequestHomeDashboard: (dashboard: DashboardLibraryItem) => void;
}) {
  const label = dashboard.isHome
    ? `${dashboard.title} is home dashboard`
    : `Set ${dashboard.title} as home dashboard`;
  const activeClass = dashboard.isHome
    ? 'border-success text-success'
    : 'border-border text-text-soft hover:border-text-soft hover:text-text';

  return (
    <Button
      ariaLabel={label}
      aria-pressed={dashboard.isHome}
      disabled={isSaving || dashboard.isHome}
      title={label}
      twStyles={`grid h-10 w-10 shrink-0 place-items-center rounded-[5px] border transition-colors ${activeClass}`}
      onClick={() => onRequestHomeDashboard(dashboard)}
    >
      <Icon icon="home" twStyles="h-5 w-5" />
    </Button>
  );
}

function DashboardHomeConfirmationDialog({
  dashboard,
  pinnedDashboardUids,
  onCancel,
  onSaved,
  setItems,
  setSavingDashboardUid,
}: {
  dashboard: DashboardLibraryItem;
  pinnedDashboardUids: string[];
  onCancel: () => void;
  onSaved: () => void;
  setItems: Dispatch<SetStateAction<DashboardLibraryItem[]>>;
  setSavingDashboardUid: (dashboardUid: string | null) => void;
}) {
  const router = useRouter();
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
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Dashboard could not be set as home'));
      }

      const payload = await response.json() as {
        preferences?: {
          homeDashboardUid?: string;
          pinnedDashboardUids?: string[];
        };
      };
      const savedHomeDashboardUid = payload.preferences?.homeDashboardUid ?? dashboard.uid;
      const savedPinnedDashboardUids = new Set(payload.preferences?.pinnedDashboardUids ?? pinnedDashboardUids);

      setItems((currentItems) => currentItems.map((item) => ({
        ...item,
        isHome: item.uid === savedHomeDashboardUid,
        isPinned: savedPinnedDashboardUids.has(item.uid),
      })));
      notifySuccess('Home dashboard updated');
      router.refresh();
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
      twStyles="grid h-10 w-10 shrink-0 place-items-center rounded-[5px] border border-border text-text-soft transition-colors hover:border-text-soft hover:text-text"
      onClick={() => savePinnedState(!dashboard.isPinned)}
    >
      <Icon icon={dashboard.isPinned ? 'bookmark-filled' : 'bookmark'} twStyles="h-5 w-5" />
    </Button>
  );
}
