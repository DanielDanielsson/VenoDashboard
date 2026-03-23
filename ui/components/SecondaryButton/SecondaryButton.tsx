import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '../../base/Button';
import type { SecondaryButtonProps, SecondaryButtonTheme } from './SecondaryButton.types';

const THEME_CLASS: Record<SecondaryButtonTheme, string> = {
  light: 'theme-secondary-button-light',
  dark: 'theme-secondary-button-dark',
};

export const SecondaryButton = ({
  isActive = false,
  theme,
  children,
  twStyles,
  ...rest
}: SecondaryButtonProps): ReactElement => (
  <Button
    twStyles={twMerge(
      'ui_caption_strong cursor-pointer rounded-[4px] border px-2 py-2 transition-colors',
      theme && THEME_CLASS[theme],
      isActive
        ? 'border-[var(--color-secondary-button-active-border)] bg-[var(--color-secondary-button-active-bg)] text-[var(--color-secondary-button-active-text)]'
        : 'border-[var(--color-secondary-button-inactive-border)] bg-transparent text-[var(--color-secondary-button-inactive-text)]',
      twStyles,
    )}
    {...rest}
  >
    {children}
  </Button>
);
