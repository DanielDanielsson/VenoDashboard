'use client';

import type { ReactElement } from 'react';
import { InfoPopover } from '../InfoPopover';
import type { HoverPanelProps } from './HoverPanel.types';

export const HoverPanel = ({
  title,
  body,
  ariaLabel,
  sourceLabel = 'Source',
  sourceValue,
  twStyles,
  theme,
}: HoverPanelProps): ReactElement => (
  <InfoPopover
    title={title}
    body={body}
    ariaLabel={ariaLabel}
    sourceLabel={sourceLabel}
    sourceValue={sourceValue}
    twStyles={twStyles}
    theme={theme}
  />
);
