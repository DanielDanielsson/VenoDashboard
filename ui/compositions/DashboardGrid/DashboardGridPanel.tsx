'use client';

import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { useDashboardGridActions } from './DashboardGrid';

type DashboardGridPanelProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  panelId: string;
  title: string;
};

export const DashboardGridPanel = forwardRef<HTMLDivElement, DashboardGridPanelProps>(
  function DashboardGridPanel({ children, className, ...props }, ref) {
    const { panelId, title, ...divProps } = props;
    const { isEditMode, isLayoutEditingEnabled } = useDashboardGridActions();

    return (
      <div
        ref={ref}
        className={twMerge(
          'relative h-full min-h-0 [&>section]:h-full',
          isLayoutEditingEnabled && '[&_.dashboard-panel-drag-handle]:cursor-move',
          className,
        )}
        data-dashboard-panel-id={panelId}
        {...divProps}
      >
        {isEditMode ? (
          <DashboardGridPanelActions panelId={panelId} title={title} />
        ) : null}
        {children}
      </div>
    );
  },
);

function DashboardGridPanelActions({
  panelId,
  title,
}: {
  panelId: string;
  title: string;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { editPanel, viewPanel } = useDashboardGridActions();

  return (
    <>
      <Button
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        ariaLabel={`Open panel actions for ${title}`}
        twStyles="grid-drag-cancel absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-[4px] text-text-soft hover:bg-surface-muted hover:text-text"
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span aria-hidden="true" className="grid gap-1">
          <span className="block h-1 w-1 rounded-full bg-current" />
          <span className="block h-1 w-1 rounded-full bg-current" />
          <span className="block h-1 w-1 rounded-full bg-current" />
        </span>
      </Button>
      {isMenuOpen ? (
        <div
          aria-label={`Panel actions for ${title}`}
          role="menu"
          className="grid-drag-cancel absolute right-2 top-11 z-30 grid min-w-28 gap-1 rounded-[4px] border border-border bg-surface px-1 py-1 shadow-lg"
        >
          <Button
            role="menuitem"
            twStyles="ui_caption w-full rounded-[4px] px-3 py-2 text-left text-text hover:bg-surface-muted"
            onClick={() => {
              setIsMenuOpen(false);
              viewPanel(panelId);
            }}
          >
            View
          </Button>
          <Button
            role="menuitem"
            twStyles="ui_caption w-full rounded-[4px] px-3 py-2 text-left text-text hover:bg-surface-muted"
            onClick={() => {
              setIsMenuOpen(false);
              editPanel({ panelId, title });
            }}
          >
            Edit
          </Button>
        </div>
      ) : null}
    </>
  );
}
