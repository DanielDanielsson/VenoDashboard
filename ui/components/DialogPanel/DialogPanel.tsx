import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { DialogPanelProps } from './DialogPanel.types';

export const DialogPanel = ({
  title,
  children,
  widthClassName,
  overlayTestId,
  twStyles,
}: DialogPanelProps): ReactElement => (
  <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
    <div data-testid={overlayTestId} className="absolute inset-0 bg-black/30 backdrop-blur-[3px] dark:bg-black/60" />
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={twMerge('relative z-10 w-[min(34rem,calc(100%-2rem))]', widthClassName)}
    >
      <section className={twMerge('overflow-hidden rounded-lg border border-border bg-surface shadow-2xl', twStyles)}>
        <div className="border-b border-border px-6 py-4">
          <h2 className="panel_title text-text">{title}</h2>
        </div>
        <div className="p-6">{children}</div>
      </section>
    </div>
  </div>
);
