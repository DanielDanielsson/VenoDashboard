'use client';

import { useState, type ReactNode, type TransitionEvent } from 'react';
import { twMerge } from 'tailwind-merge';

interface DashboardSettingsAccordionProps {
  open: boolean;
  children: ReactNode;
}

export const DashboardSettingsAccordion = ({ open, children }: DashboardSettingsAccordionProps) => {
  const [renderState, setRenderState] = useState({
    isClosing: false,
    previousOpen: open,
  });

  if (renderState.previousOpen !== open) {
    setRenderState({
      isClosing: !open && renderState.previousOpen,
      previousOpen: open,
    });
  }

  const isMounted = open || renderState.isClosing;

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      event.propertyName === 'grid-template-rows' &&
      !open
    ) {
      setRenderState((currentState) => (
        currentState.isClosing
          ? { ...currentState, isClosing: false }
          : currentState
      ));
    }
  };

  return (
    <div
      aria-hidden={!open}
      className={twMerge(
        'grid overflow-hidden transition-[grid-template-rows] duration-dashboard-order ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="min-h-0 overflow-hidden">
        {isMounted ? children : null}
      </div>
    </div>
  );
};
