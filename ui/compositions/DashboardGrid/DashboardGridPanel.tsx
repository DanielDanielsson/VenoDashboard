'use client';

import { forwardRef, useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { KeyboardKey } from '@ui/components/KeyboardKey';
import { useDashboardGridActions } from './DashboardGrid';

type DashboardGridPanelProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  panelId: string;
  title: string;
};

export const DashboardGridPanel = forwardRef<HTMLDivElement, DashboardGridPanelProps>(
  function DashboardGridPanel({ children, className, ...props }, ref) {
    const { panelId, title, ...divProps } = props;
    const { isLayoutEditingEnabled, viewedPanelId, setHoveredPanel } = useDashboardGridActions();
    const isSoloPanelView = viewedPanelId === panelId;

    return (
      <div
        ref={ref}
        className={twMerge(
          'relative h-full min-h-0 [&>section]:h-full',
          isLayoutEditingEnabled && '[&_.dashboard-panel-drag-handle]:cursor-move',
          isSoloPanelView && '[&>section]:flex [&>section]:flex-col [&>section>div:last-child]:min-h-0 [&>section>div:last-child]:overflow-y-auto',
          className,
        )}
        data-dashboard-panel-id={panelId}
        onMouseEnter={() => setHoveredPanel(panelId)}
        onMouseLeave={() => setHoveredPanel(null)}
        {...divProps}
      >
        <DashboardGridPanelActions panelId={panelId} title={title} />
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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { editPanel, hoveredPanelId, viewPanel } = useDashboardGridActions();
  const isVisible = hoveredPanelId === panelId || isMenuOpen;

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      setIsMenuOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isMenuOpen]);

  return (
    <>
      <Button
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        ariaLabel={`Open panel actions for ${title}`}
        twStyles={twMerge(
          'grid-drag-cancel absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-[4px] text-text-soft transition-opacity hover:bg-surface-muted hover:text-text',
          isVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
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
          ref={menuRef}
          aria-label={`Panel actions for ${title}`}
          role="menu"
          className="grid-drag-cancel absolute right-2 top-11 z-30 grid min-w-36 gap-1 overflow-hidden rounded-[4px] border border-dashboard-panel-menu-border bg-dashboard-panel-menu-bg p-1 text-dashboard-panel-menu-text shadow-dashboard-panel-menu"
        >
          <Button
            ariaLabel="View"
            role="menuitem"
            twStyles="ui_caption grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-[4px] px-2 py-1.5 text-left text-dashboard-panel-menu-text-muted transition-colors hover:bg-dashboard-panel-menu-hover-bg hover:text-dashboard-panel-menu-text"
            onClick={() => {
              setIsMenuOpen(false);
              viewPanel(panelId);
            }}
          >
            <span>View</span>
            <KeyboardKey aria-label="Keyboard shortcut V">V</KeyboardKey>
          </Button>
          <Button
            ariaLabel="Edit"
            role="menuitem"
            twStyles="ui_caption grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-[4px] px-2 py-1.5 text-left text-dashboard-panel-menu-text-muted transition-colors hover:bg-dashboard-panel-menu-hover-bg hover:text-dashboard-panel-menu-text"
            onClick={() => {
              setIsMenuOpen(false);
              editPanel({ panelId, title });
            }}
          >
            <span>Edit</span>
            <span aria-hidden="true" className="h-5 min-w-5" />
          </Button>
        </div>
      ) : null}
    </>
  );
}
