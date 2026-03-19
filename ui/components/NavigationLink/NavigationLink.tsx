import type { ReactElement } from 'react';
import { Link } from '../../base/Link';
import type { NavigationLinkProps } from './NavigationLink.types';

export const NavigationLink = ({
  children,
  ...rest
}: NavigationLinkProps): ReactElement => (
  <li>
    <Link {...rest}>{children}</Link>
  </li>
);
