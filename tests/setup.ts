import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class MutationObserverMock {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(globalThis, 'MutationObserver', {
  writable: true,
  value: MutationObserverMock,
});

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  writable: true,
  value: true,
});

Object.defineProperty(globalThis, 'requestAnimationFrame', {
  writable: true,
  value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0),
});

Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  writable: true,
  value: (id: number) => window.clearTimeout(id),
});

const MockNextLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>(function MockNextLink({ href, children, ...props }, ref) {
  return React.createElement('a', { href, ref, ...props }, children);
});

vi.mock('next/link', () => ({
  default: MockNextLink,
}));

afterEach(() => {
  cleanup();
});
