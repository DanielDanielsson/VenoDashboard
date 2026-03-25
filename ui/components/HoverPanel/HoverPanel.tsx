'use client';

import { useState, type ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { DashboardPanel } from '../DashboardPanel';
import type { HoverPanelProps } from './HoverPanel.types';

export const HoverPanel = ({
  title,
  body,
  ariaLabel,
  sourceLabel = 'Source',
  sourceValue,
  twStyles,
  theme,
}: HoverPanelProps): ReactElement => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={twMerge('relative inline-flex items-center', twStyles)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      <Button
        ariaLabel={ariaLabel ?? title ?? 'More information'}
        twStyles={twMerge(
          'inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-text-soft transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none',
          isOpen ? 'opacity-100' : 'opacity-90',
        )}
      >
        <Icon icon="info" twStyles="h-4 w-4" />
      </Button>

      {isOpen ? (
        <div
          role="tooltip"
          className="absolute left-full top-1/2 z-30 ml-2 w-72 -translate-y-1/2"
        >
          <DashboardPanel
            title={title ?? 'Info'}
            theme={theme}
            twStyles="overflow-hidden rounded-lg rounded-tr-none shadow-lg"
          >
            <p className="body_text text-text">{body}</p>
            {sourceValue ? (
              <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <p className="ui_micro_label text-text-soft">{sourceLabel}</p>
                <p className="body_text mt-1 text-text">{sourceValue}</p>
              </div>
            ) : null}
          </DashboardPanel>
        </div>
      ) : null}
    </div>
  );
};
