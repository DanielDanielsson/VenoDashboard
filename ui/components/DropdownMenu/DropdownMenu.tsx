'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';

export interface DropdownMenuOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

export interface DropdownMenuProps<TValue extends string = string> {
  label: string;
  value: TValue | '';
  placeholder: string;
  options: readonly DropdownMenuOption<TValue>[];
  onChange: (value: TValue) => void;
  disabled?: boolean;
  twStyles?: string;
}

const ChevronDownIcon = (): ReactElement => {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 7.5 10 12l5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const DropdownMenu = <TValue extends string = string,>({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
  twStyles,
}: DropdownMenuProps<TValue>): ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const listboxId = useId();
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  return (
    <div ref={rootRef} className={twMerge('relative grid gap-2', twStyles)}>
      <span id={triggerId} className="ui_micro_label text-text-soft">
        {label}
      </span>
      <Button
        ariaLabel={label}
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        twStyles="ui_caption flex h-9 min-w-[11rem] items-center justify-between gap-3 rounded-[4px] border border-dashboard-time-picker-border bg-dashboard-time-picker-bg px-3 text-left text-dashboard-time-picker-text shadow-sm transition-colors hover:bg-dashboard-time-picker-bg-hover"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={twMerge('min-w-0 flex-1 truncate', !selectedOption && 'text-dashboard-time-picker-text-muted')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="text-dashboard-time-picker-text-muted">
          <ChevronDownIcon />
        </span>
      </Button>

      {isOpen ? (
        <div
          aria-labelledby={triggerId}
          className="absolute left-0 top-[calc(100%+0.35rem)] z-30 w-full min-w-[12rem] overflow-hidden rounded-[4px] border border-dashboard-time-picker-border bg-dashboard-time-picker-panel-bg text-dashboard-time-picker-text shadow-dashboard-time-picker-panel"
          id={listboxId}
          role="listbox"
        >
          <div className="grid gap-1 p-1.5">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <Button
                  aria-selected={isSelected}
                  key={option.value}
                  role="option"
                  twStyles={twMerge(
                    'ui_caption w-full rounded-[4px] px-2 py-2 text-left transition-colors',
                    isSelected
                      ? 'bg-dashboard-time-picker-bg-hover text-dashboard-time-picker-text'
                      : 'text-dashboard-time-picker-text-muted hover:bg-dashboard-time-picker-bg-hover hover:text-dashboard-time-picker-text',
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
