'use client';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, payload: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, payload);
    return;
  }

  console.info('[analytics]', eventName, payload);
}
