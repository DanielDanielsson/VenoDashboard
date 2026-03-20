import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { IconProps } from './Icon.types';

const SPRITE_PATH = '/static_assets/iconSprite.svg';

export const Icon = ({
  icon,
  twStyles,
  title,
  size,
}: IconProps): ReactElement => (
  <svg
    className={twMerge('inline h-4 w-4 flex-none fill-current', size, twStyles)}
    aria-hidden={!title}
  >
    {title && <title>{title}</title>}
    <use href={`${SPRITE_PATH}#${icon}`} />
  </svg>
);
