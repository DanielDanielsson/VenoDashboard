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
        ? 'border-secondary-button-active-border bg-secondary-button-active-bg text-secondary-button-active-text'
        : 'border-secondary-button-inactive-border bg-secondary-button-inactive-bg text-secondary-button-inactive-text',
      twStyles,
    )}
    {...rest}
  >
    {children}
  </Button>
);
