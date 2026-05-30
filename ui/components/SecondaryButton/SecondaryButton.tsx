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
      'ui_caption_strong cursor-pointer rounded-[4px] border px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-button-active-border',
      theme && THEME_CLASS[theme],
      isActive
        ? 'border-secondary-button-active-border bg-secondary-button-active-bg text-secondary-button-active-text enabled:hover:border-secondary-button-active-border-hover enabled:hover:bg-secondary-button-active-bg-hover enabled:hover:text-secondary-button-active-text-hover'
        : 'border-secondary-button-inactive-border bg-secondary-button-inactive-bg text-secondary-button-inactive-text enabled:hover:border-secondary-button-inactive-border-hover enabled:hover:bg-secondary-button-inactive-bg-hover enabled:hover:text-secondary-button-inactive-text-hover',
      twStyles,
    )}
    {...rest}
  >
    {children}
  </Button>
);
