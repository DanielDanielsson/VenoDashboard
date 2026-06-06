import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { DialogPanelProps } from './DialogPanel.types';

export const DialogPanel = ({
  title,
  children,
  widthClassName,
  contentClassName,
  overlayTestId,
  twStyles,
}: DialogPanelProps): ReactElement => (
  <div className="fixed inset-0 z-50 overflow-y-auto p-4">
    <div data-testid={overlayTestId} className="fixed inset-0 bg-black/30 backdrop-blur-[3px] dark:bg-black/60" />
    <div className="relative z-10 flex min-h-full items-center justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={twMerge('w-[min(34rem,calc(100%-2rem))]', widthClassName)}
      >
        <section className={twMerge('max-h-[calc(100vh-2rem)] overflow-hidden rounded-[5px] border border-dashboard-panel-border bg-dashboard-panel-bg shadow-2xl', twStyles)}>
          <div className="border-b border-dashboard-panel-border bg-dashboard-panel-header-bg px-6 py-4">
            <h2 className="panel_title text-dashboard-panel-title">{title}</h2>
          </div>
          <div className={twMerge('max-h-[calc(100vh-7rem)] overflow-y-auto p-6', contentClassName)}>
            {children}
          </div>
        </section>
      </div>
    </div>
  </div>
);
