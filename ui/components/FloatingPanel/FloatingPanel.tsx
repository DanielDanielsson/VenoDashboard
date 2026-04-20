import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { FloatingPanelProps } from './FloatingPanel.types';

export const FloatingPanel = ({
  title,
  children,
  twStyles,
}: FloatingPanelProps): ReactElement => (
  <section className={twMerge('overflow-hidden rounded-lg border border-border bg-surface shadow-2xl', twStyles)}>
    <div className="border-b border-border px-6 py-4">
      <h2 className="panel_title text-text">{title}</h2>
    </div>
    <div className="p-6">{children}</div>
  </section>
);
