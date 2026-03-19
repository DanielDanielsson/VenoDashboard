import type { ComponentPropsWithRef } from 'react';
import type NextLink from 'next/link';
import { Stylable } from '../../types';

export type LinkProps = Stylable &
  ComponentPropsWithRef<typeof NextLink> & {
    ariaLabel?: string;
  };
