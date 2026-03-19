'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const HIDE_SCROLL_THRESHOLD = 120;
const SHOW_SCROLL_THRESHOLD = 56;
const TOP_RESET_THRESHOLD = 24;

export function SiteHeaderShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isGlucosePage = pathname === '/dashboard/glucose';
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const toggleAnchorYRef = useRef(0);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    function syncVisibility(nextVisible: boolean) {
      if (isVisibleRef.current === nextVisible) {
        return;
      }

      isVisibleRef.current = nextVisible;
      setIsVisible(nextVisible);
    }

    const initialScrollY = window.scrollY;
    lastScrollYRef.current = initialScrollY;
    toggleAnchorYRef.current = initialScrollY;
    syncVisibility(true);

    if (isGlucosePage) {
      return;
    }

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const previousScrollY = lastScrollYRef.current;

      if (currentScrollY <= TOP_RESET_THRESHOLD) {
        toggleAnchorYRef.current = currentScrollY;
        syncVisibility(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (currentScrollY > previousScrollY) {
        if (
          isVisibleRef.current &&
          currentScrollY >= HIDE_SCROLL_THRESHOLD &&
          currentScrollY - toggleAnchorYRef.current >= HIDE_SCROLL_THRESHOLD
        ) {
          toggleAnchorYRef.current = currentScrollY;
          syncVisibility(false);
        }
      } else if (currentScrollY < previousScrollY) {
        if (isVisibleRef.current) {
          toggleAnchorYRef.current = currentScrollY;
        } else if (toggleAnchorYRef.current - currentScrollY >= SHOW_SCROLL_THRESHOLD) {
          toggleAnchorYRef.current = currentScrollY;
          syncVisibility(true);
        }
      }

      lastScrollYRef.current = currentScrollY;
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isGlucosePage, pathname]);

  return (
    <div
      className="site-header-shell"
      data-header-mode={isGlucosePage ? 'static' : 'smart'}
      data-header-visible={isVisible ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}
