'use client';

import { useState, type ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import type { InfoPopoverProps } from './InfoPopover.types';

export const InfoPopover = ({
  title,
  body,
  ariaLabel,
  sourceLabel = 'Source',
  sourceValue,
  twStyles,
  theme,
}: InfoPopoverProps): ReactElement => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={twMerge('relative inline-flex items-center', theme === 'dark' && 'theme-dark', twStyles)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      <Button
        ariaLabel={ariaLabel ?? title ?? 'More information'}
        twStyles={twMerge(
          'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full p-1 text-text-soft transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none',
          isOpen ? 'opacity-100' : 'opacity-90',
        )}
      >
        <Icon icon="info" twStyles="h-5 w-5" />
      </Button>

      {isOpen ? (
        <div role="tooltip" className="absolute left-full top-1/2 z-50 ml-2 w-72 -translate-y-1/2">
          <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
            <div className="border-b border-border px-4 py-3">
              <h3 className="panel_title text-text">{title ?? 'Info'}</h3>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="body_text text-text">{body}</div>
              {sourceValue ? (
                <div className="border-t border-border pt-3">
                  <p className="ui_micro_label text-text-soft">{sourceLabel}</p>
                  <div className="body_text mt-1 text-text">{sourceValue}</div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};
