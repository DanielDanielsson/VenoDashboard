import type { ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';

import './keyboardKey.css';

type KeyboardKeyProps = ComponentPropsWithoutRef<'kbd'>;

export function KeyboardKey({ children, className, ...props }: KeyboardKeyProps) {
  return (
    <kbd
      className={twMerge(
        'ui_keyboard_key inline-grid h-5 min-w-5 select-none place-items-center rounded-[5px] border border-keyboard-key-border bg-keyboard-key-bg px-1 text-keyboard-key-text shadow-keyboard-key',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
