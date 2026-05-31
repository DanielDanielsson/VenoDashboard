'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';

type NotificationVariant = 'neutral' | 'success' | 'warning' | 'error';

interface NotificationOptions {
  message?: string;
  durationMs?: number;
}

interface NotificationItem extends NotificationOptions {
  id: string;
  title: string;
  variant: NotificationVariant;
  dismissAt: number;
  pausedRemainingMs: number | null;
}

interface NotificationState {
  exitWindowEndsAt: number | null;
  exitingCount: number;
  queuedItems: NotificationItem[];
  visibleItems: NotificationItem[];
}

interface NotificationsContextValue {
  notify: (title: string, options?: NotificationOptions) => void;
  notifySuccess: (title: string, options?: NotificationOptions) => void;
  notifyWarning: (title: string, options?: NotificationOptions) => void;
  notifyError: (title: string, options?: NotificationOptions) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const VARIANT_ACCENT_CLASS: Record<NotificationVariant, string> = {
  neutral: 'bg-border',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

const DEFAULT_DURATION_MS: Record<NotificationVariant, number> = {
  neutral: 4000,
  success: 4000,
  warning: 6000,
  error: 8000,
};
const MAX_VISIBLE_NOTIFICATIONS = 5;

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<NotificationState>({
    exitWindowEndsAt: null,
    exitingCount: 0,
    queuedItems: [],
    visibleItems: [],
  });
  const nextIdRef = useRef(0);
  const isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const motionMode =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'fade'
      : 'slide';
  const exitDurationMs = isTestEnvironment ? 0 : motionMode === 'fade' ? 160 : 220;

  function promoteQueuedItems(current: NotificationState): NotificationState {
    const openSlotCount = Math.max(0, MAX_VISIBLE_NOTIFICATIONS - current.visibleItems.length);

    if (openSlotCount === 0 || current.queuedItems.length === 0) {
      return {
        ...current,
        exitWindowEndsAt: null,
        exitingCount: 0,
      };
    }

    const promotedItems = current.queuedItems.slice(0, openSlotCount);

    return {
      exitWindowEndsAt: null,
      exitingCount: 0,
      queuedItems: current.queuedItems.slice(openSlotCount),
      visibleItems: [...promotedItems.reverse(), ...current.visibleItems],
    };
  }

  const dismissNotification = useCallback((notificationId: string) => {
    setState((current) => {
      const nextVisibleItems = current.visibleItems.filter((item) => item.id !== notificationId);
      if (nextVisibleItems.length === current.visibleItems.length) {
        return {
          exitWindowEndsAt: current.exitWindowEndsAt,
          exitingCount: current.exitingCount,
          queuedItems: current.queuedItems,
          visibleItems: nextVisibleItems,
        };
      }

      return {
        exitWindowEndsAt: Date.now() + exitDurationMs,
        exitingCount: current.exitingCount + 1,
        queuedItems: current.queuedItems,
        visibleItems: nextVisibleItems,
      };
    });
  }, [exitDurationMs]);

  function pauseNotification(notificationId: string) {
    setState((current) => ({
      exitWindowEndsAt: current.exitWindowEndsAt,
      exitingCount: current.exitingCount,
      queuedItems: current.queuedItems,
      visibleItems: current.visibleItems.map((item) => item.id === notificationId
        ? {
            ...item,
            pausedRemainingMs: Math.max(0, item.dismissAt - Date.now()),
          }
        : item),
    }));
  }

  function resumeNotification(notificationId: string) {
    setState((current) => ({
      exitWindowEndsAt: current.exitWindowEndsAt,
      exitingCount: current.exitingCount,
      queuedItems: current.queuedItems,
      visibleItems: current.visibleItems.map((item) => item.id === notificationId
        ? {
            ...item,
            dismissAt: Date.now() + (item.pausedRemainingMs ?? 0),
            pausedRemainingMs: null,
          }
        : item),
    }));
  }

  useEffect(() => {
    const timers = state.visibleItems.flatMap((item) => {
      if (item.pausedRemainingMs !== null) {
        return [];
      }

      return [window.setTimeout(() => {
        dismissNotification(item.id);
      }, Math.max(0, item.dismissAt - Date.now()))];
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismissNotification, state.visibleItems]);

  useEffect(() => {
    if (state.exitingCount === 0 || state.exitWindowEndsAt === null) {
      return;
    }

    const remainingMs = Math.max(0, state.exitWindowEndsAt - Date.now());
    const timer = window.setTimeout(() => {
      setState((current) => promoteQueuedItems(current));
    }, remainingMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state.exitWindowEndsAt, state.exitingCount]);

  const contextValue = useMemo<NotificationsContextValue>(() => {
    function pushNotification(variant: NotificationVariant, title: string, options?: NotificationOptions) {
      setState((current) => {
        const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS[variant];
        const dismissAt = Date.now() + durationMs;
        const nextItem = (itemId: string): NotificationItem => ({
          id: itemId,
          title,
          variant,
          ...options,
          dismissAt,
          pausedRemainingMs: null,
        });

        nextIdRef.current += 1;
        const createdItem = nextItem(`notification-${nextIdRef.current}`);

        if (current.visibleItems.length + current.exitingCount < MAX_VISIBLE_NOTIFICATIONS) {
          return {
            exitWindowEndsAt: current.exitWindowEndsAt,
            exitingCount: current.exitingCount,
            queuedItems: current.queuedItems,
            visibleItems: [createdItem, ...current.visibleItems],
          };
        }

        return {
          exitWindowEndsAt: current.exitWindowEndsAt,
          exitingCount: current.exitingCount,
          queuedItems: [...current.queuedItems, createdItem],
          visibleItems: current.visibleItems,
        };
      });
    }

    return {
      notify: (title, options) => pushNotification('neutral', title, options),
      notifySuccess: (title, options) => pushNotification('success', title, options),
      notifyWarning: (title, options) => pushNotification('warning', title, options),
      notifyError: (title, options) => pushNotification('error', title, options),
    };
  }, []);

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 bottom-4 z-notifications flex w-[min(24rem,calc(100vw-2rem))] flex-col-reverse gap-3"
      >
        <AnimatePresence initial={false}>
          {state.visibleItems.map((item) => (
            <motion.article
              key={item.id}
              layout="position"
              initial={motionMode === 'fade' ? { opacity: 0 } : { opacity: 0, x: 28 }}
              animate={motionMode === 'fade' ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={motionMode === 'fade' ? { opacity: 0 } : { opacity: 0, x: 28 }}
              transition={
                isTestEnvironment
                  ? {
                      duration: 0,
                      layout: { duration: 0 },
                      opacity: { duration: 0 },
                      x: { duration: 0 },
                    }
                  : motionMode === 'fade'
                  ? {
                      duration: 0.16,
                      ease: 'easeOut',
                      layout: { duration: 0.16, ease: 'easeOut' },
                    }
                  : {
                      opacity: { duration: 0.16, ease: 'easeOut' },
                      x: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                      layout: { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 },
                    }
              }
              data-motion={motionMode}
              data-variant={item.variant}
              className="pointer-events-auto overflow-hidden rounded-r-[5px] rounded-l-none border border-dashboard-panel-border bg-dashboard-panel-bg shadow-2xl"
              onMouseEnter={() => pauseNotification(item.id)}
              onMouseLeave={() => resumeNotification(item.id)}
            >
              <div className="flex">
                <div aria-hidden="true" className={twMerge('w-1 self-stretch', VARIANT_ACCENT_CLASS[item.variant])} />
                <div className="flex-1">
                  <header className="flex items-center justify-between gap-3 border-b border-dashboard-panel-border bg-dashboard-panel-header-bg pl-4 pr-1.5 py-1.5">
                    <h2 className="panel_title text-dashboard-panel-title">{item.title}</h2>
                    <Button
                      ariaLabel={`Close notification: ${item.title}`}
                      twStyles="grid h-4 w-4 place-items-center rounded-[4px] text-text-soft transition-colors hover:bg-dashboard-panel-bg hover:text-text"
                      onClick={() => dismissNotification(item.id)}
                    >
                      <Icon icon="close" size="h-3 w-3" />
                    </Button>
                  </header>
                  {item.message ? (
                    <div className="px-4 py-3">
                      <p className="body_text text-text-dim">{item.message}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </section>
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextValue => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }

  return context;
};
