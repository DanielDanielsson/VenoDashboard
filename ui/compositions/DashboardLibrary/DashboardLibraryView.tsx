import { useState } from 'react';
import type {
  CSSProperties,
  Dispatch,
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  SetStateAction,
} from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { Link } from '@ui/base/Link';
import { DialogPanel } from '@ui/components/DialogPanel';
import { SecondaryButton } from '@ui/components/SecondaryButton';
import { getDashboardDescriptionText } from '@/lib/dashboard/metadata';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import {
  DashboardCreateDialog,
  DashboardHomeButton,
  DashboardHomeConfirmationDialog,
  DashboardLibraryBadge,
  DashboardPinButton,
} from './components';
import { DashboardMetadataSettings } from './DashboardMetadataSettings';
import type { DashboardDropPosition } from './utils';

const DASHBOARD_TYPE_LABEL: Record<DashboardLibraryItem['type'], string> = {
  live: 'Live',
  timeRange: 'Time range',
};

const DASHBOARD_TYPE_ICON: Record<DashboardLibraryItem['type'], 'glucose' | 'clock'> = {
  live: 'glucose',
  timeRange: 'clock',
};

const DASHBOARD_LIBRARY_COLUMNS = {
  owner: 'grid-cols-[2.25rem_minmax(0,1fr)] md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)]',
  public: 'md:grid-cols-2',
};

const DASHBOARD_LIBRARY_DETAIL_COLUMNS = {
  owner: 'md:grid-cols-[10rem_minmax(0,1fr)_8.5rem]',
  public: 'md:grid-cols-[10rem_minmax(0,1fr)_4rem]',
};

const DASHBOARD_LIBRARY_HEADER_DETAIL_COLUMNS = {
  owner: 'md:grid-cols-[10rem_minmax(0,1fr)_12rem]',
  public: DASHBOARD_LIBRARY_DETAIL_COLUMNS.public,
};

const DASHBOARD_LIBRARY_LINK_RIGHT = {
  owner: 'right-[9.75rem]',
  public: 'right-[5.25rem]',
};

interface DashboardDropTarget {
  dashboardUid: string;
  position: DashboardDropPosition;
}

const getDashboardDropIndicatorTarget = (
  items: DashboardLibraryItem[],
  dropTarget: DashboardDropTarget | null,
  draggedDashboardUid: string | null,
): DashboardDropTarget | null => {
  if (!dropTarget || draggedDashboardUid === dropTarget.dashboardUid) {
    return null;
  }

  const targetIndex = items.findIndex((dashboard) => dashboard.uid === dropTarget.dashboardUid);
  if (targetIndex < 0) {
    return null;
  }

  const nextDashboard = items[targetIndex + 1];
  if (dropTarget.position === 'after' && nextDashboard && nextDashboard.uid !== draggedDashboardUid) {
    return {
      dashboardUid: nextDashboard.uid,
      position: 'before',
    };
  }

  return dropTarget;
};

export interface DashboardLibraryViewProps {
  items: DashboardLibraryItem[];
  isOwner: boolean;
  expandedDashboardUid: string | null;
  savingDashboardUid: string | null;
  draggedDashboardUid: string | null;
  settledDashboardUid: string | null;
  dropTarget: DashboardDropTarget | null;
  isSavingOrder: boolean;
  homeDashboardUid: string;
  pinnedDashboardUids: string[];
  dashboardOrderUids: string[];
  pendingDirtyAction: { type: string } | null;
  pendingHomeDashboard: DashboardLibraryItem | null;
  rowStyle: (dashboardUid: string) => CSSProperties;
  onRowRef: (dashboardUid: string, node: HTMLLIElement | null) => void;
  onSettledAnimationEnd: (dashboardUid: string) => void;
  onSettingsToggle: (dashboardUid: string) => void;
  onDashboardLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, dashboardUid: string) => void;
  onDragEnd: () => void;
  onGrabberKeyDown: (event: KeyboardEvent<HTMLButtonElement>, dashboardUid: string) => void;
  onListDragOver: (event: DragEvent<HTMLUListElement>) => void;
  onListDragLeave: (event: DragEvent<HTMLUListElement>) => void;
  onListDrop: (event: DragEvent<HTMLUListElement>) => void;
  onDiscardSettingsChanges: () => void;
  onKeepEditing: () => void;
  onRequestHomeDashboard: (dashboard: DashboardLibraryItem | null) => void;
  onHomeDashboardCancel: () => void;
  onHomeDashboardSaved: () => void;
  onDirtyChange: (dashboardUid: string, isDirty: boolean) => void;
  onMetadataDeleted: (dashboardUid: string) => void;
  onMetadataSaved: (previousUid: string, nextUid: string) => void;
  setSavingDashboardUid: (dashboardUid: string | null) => void;
  setItems: Dispatch<SetStateAction<DashboardLibraryItem[]>>;
}

export const DashboardLibraryView = ({
  items,
  isOwner,
  expandedDashboardUid,
  savingDashboardUid,
  draggedDashboardUid,
  settledDashboardUid,
  dropTarget,
  isSavingOrder,
  homeDashboardUid,
  pinnedDashboardUids,
  dashboardOrderUids,
  pendingDirtyAction,
  pendingHomeDashboard,
  rowStyle,
  onRowRef,
  onSettledAnimationEnd,
  onSettingsToggle,
  onDashboardLinkClick,
  onDragStart,
  onDragEnd,
  onGrabberKeyDown,
  onListDragOver,
  onListDragLeave,
  onListDrop,
  onDiscardSettingsChanges,
  onKeepEditing,
  onRequestHomeDashboard,
  onHomeDashboardCancel,
  onHomeDashboardSaved,
  onDirtyChange,
  onMetadataDeleted,
  onMetadataSaved,
  setSavingDashboardUid,
  setItems,
}: DashboardLibraryViewProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const dashboardLibraryColumns = isOwner ? DASHBOARD_LIBRARY_COLUMNS.owner : DASHBOARD_LIBRARY_COLUMNS.public;
  const dashboardLibraryDetailColumns = isOwner ? DASHBOARD_LIBRARY_DETAIL_COLUMNS.owner : DASHBOARD_LIBRARY_DETAIL_COLUMNS.public;
  const dashboardLibraryHeaderDetailColumns = isOwner ? DASHBOARD_LIBRARY_HEADER_DETAIL_COLUMNS.owner : DASHBOARD_LIBRARY_HEADER_DETAIL_COLUMNS.public;
  const dashboardLinkRightClass = isOwner ? DASHBOARD_LIBRARY_LINK_RIGHT.owner : DASHBOARD_LIBRARY_LINK_RIGHT.public;
  const dropIndicatorTarget = getDashboardDropIndicatorTarget(items, dropTarget, draggedDashboardUid);

  return (
    <div className="relative grid gap-2">
      {isOwner ? (
        <Button
          ariaLabel="Create dashboard from compact header"
          twStyles="ui_button_text w-full whitespace-nowrap rounded-[5px] border border-accent bg-accent px-4 py-3 text-base-white transition-colors hover:border-accent-strong hover:bg-accent-strong md:hidden"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          Create Dashboard
        </Button>
      ) : null}
      <div
        className={twMerge('hidden gap-6 rounded-[4px] border border-dashboard-panel-border bg-dashboard-library-header-bg px-5 py-3 md:grid md:items-center', dashboardLibraryColumns)}
        data-testid="dashboard-library-header"
      >
        {isOwner ? <span aria-hidden="true" /> : null}
        <span className="body_text text-text-soft">Name</span>
        <span className={twMerge('grid gap-6 md:items-center', dashboardLibraryHeaderDetailColumns)}>
          <span className="body_text text-text-soft">Type</span>
          <span className="body_text text-text-soft">Tag</span>
          {isOwner ? (
            <span className="flex justify-end">
              <Button
                ariaLabel="Create dashboard"
                twStyles="ui_button_text whitespace-nowrap rounded-[5px] border border-accent bg-accent px-4 py-2 text-base-white transition-colors hover:border-accent-strong hover:bg-accent-strong"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                Create Dashboard
              </Button>
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
        </span>
      </div>
      <ul
        aria-label="Dashboards"
        className="dashboard-library-list grid gap-2"
        onDragOver={onListDragOver}
        onDragLeave={onListDragLeave}
        onDrop={onListDrop}
      >
        {items.map((dashboard) => (
          <li
            key={dashboard.uid}
            ref={(node) => onRowRef(dashboard.uid, node)}
            className={twMerge(
              'dashboard-library-row relative overflow-visible rounded-[6px] border border-dashboard-panel-border bg-dashboard-panel-header-bg shadow-sm hover:border-text-soft',
              draggedDashboardUid === dashboard.uid && 'opacity-60 ring-1 ring-text-soft',
            )}
            data-dashboard-order-state={settledDashboardUid === dashboard.uid ? 'settled' : undefined}
            style={rowStyle(dashboard.uid)}
            onAnimationEnd={(event) => {
              if (event.currentTarget === event.target) {
                onSettledAnimationEnd(dashboard.uid);
              }
            }}
          >
            {dropIndicatorTarget?.dashboardUid === dashboard.uid ? (
              <span
                aria-hidden="true"
                className={twMerge(
                  'dashboard-library-drop-indicator pointer-events-none absolute inset-x-0 z-20 bg-accent',
                  dropIndicatorTarget.position === 'before'
                    ? 'dashboard-library-drop-indicator-before'
                    : 'dashboard-library-drop-indicator-after',
                )}
              />
            ) : null}
            <article className={twMerge('relative grid min-h-[4.5rem] gap-6 p-5', dashboardLibraryColumns)}>
              <Link
                ariaLabel={`Open ${dashboard.title} dashboard`}
                href={`/dashboards/${dashboard.uid}`}
                onClick={(event) => onDashboardLinkClick(event, `/dashboards/${dashboard.uid}`)}
                twStyles={twMerge('absolute inset-y-0 left-0 z-0 hidden md:block', dashboardLinkRightClass)}
              >
                <span className="sr-only">Open {dashboard.title} dashboard</span>
              </Link>
              {isOwner ? (
                <span className="z-[3] flex items-center justify-start">
                  <Button
                    ariaLabel={`Drag ${dashboard.title} to reorder`}
                    disabled={isSavingOrder}
                    draggable={!isSavingOrder}
                    onDragStart={(event) => onDragStart(event, dashboard.uid)}
                    onDragEnd={onDragEnd}
                    onKeyDown={(event) => onGrabberKeyDown(event, dashboard.uid)}
                    title={`Drag ${dashboard.title} to reorder`}
                    twStyles="grid h-10 w-8 place-items-center rounded-[4px] text-text-soft transition-colors hover:bg-dashboard-time-picker-bg-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong cursor-grab active:cursor-grabbing"
                  >
                    <Icon icon="grabber" twStyles="h-6 w-6" />
                  </Button>
                </span>
              ) : null}
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
              <div className={twMerge('z-[1] grid min-w-0 gap-4 md:items-center md:gap-6', isOwner && 'col-start-2 md:col-start-auto', dashboardLibraryDetailColumns)}>
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
                        onRequestHomeDashboard={onRequestHomeDashboard}
                      />
                      <DashboardPinButton
                        dashboard={dashboard}
                        homeDashboardUid={homeDashboardUid}
                        pinnedDashboardUids={pinnedDashboardUids}
                        dashboardOrderUids={dashboardOrderUids}
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
                    onClick={() => onSettingsToggle(dashboard.uid)}
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
                onDeleted={onMetadataDeleted}
                onDirtyChange={onDirtyChange}
                onSaved={onMetadataSaved}
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
                onClick={onKeepEditing}
              >
                Keep editing
              </SecondaryButton>
              <SecondaryButton
                aria-label="Discard settings changes"
                onClick={onDiscardSettingsChanges}
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
          dashboardOrderUids={dashboardOrderUids}
          pinnedDashboardUids={pinnedDashboardUids}
          onCancel={onHomeDashboardCancel}
          onSaved={onHomeDashboardSaved}
          setItems={setItems}
          setSavingDashboardUid={setSavingDashboardUid}
        />
      ) : null}
      <DashboardCreateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />
    </div>
  );
};
