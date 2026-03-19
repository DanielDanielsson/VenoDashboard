import type { ReactElement, Ref } from 'react';
import { forwardRef } from 'react';
import NextLink from 'next/link';
import { twMerge } from 'tailwind-merge';
import { LinkProps } from './Link.types';

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  (
    { ariaLabel, children, twStyles, className, ...rest }: LinkProps,
    ref: Ref<HTMLAnchorElement>,
  ): ReactElement | null => (
    <NextLink
      aria-label={ariaLabel}
      className={twMerge(className, twStyles)}
      ref={ref}
      {...rest}
    >
      {children}
    </NextLink>
  ),
);

Link.displayName = 'Link';
