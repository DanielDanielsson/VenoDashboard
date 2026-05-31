'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from '../../base/Icon';

const STORAGE_KEY = 'pulse-theme';
type Theme = 'light' | 'dark';
const THEME_EVENT = 'pulse-theme-change';

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
};

const readThemeSnapshot = (): Theme => {
  if (typeof document === 'undefined') {
    return 'dark';
  }

  return document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light';
};

const subscribeToTheme = (callback: () => void): () => void => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener('storage', handleStorage);
  };
};

const subscribeToMount = (): () => void => {
  return () => undefined;
};

export const ThemeToggle = () => {
  const theme = useSyncExternalStore(subscribeToTheme, readThemeSnapshot, () => 'dark');
  const isMounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

  function toggleTheme() {
    applyTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const iconName = isMounted ? (theme === 'dark' ? 'moon' : 'sun') : 'moon';
  const activeThemeLabel = isMounted ? theme : 'dark';
  const nextThemeLabel = isMounted ? nextTheme : 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${nextThemeLabel} theme`}
      title={`Switch to ${nextThemeLabel} theme`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        <Icon icon={iconName} twStyles="h-[18px] w-[18px]" />
      </span>
      <span className="sr-only">{activeThemeLabel} theme active</span>
    </button>
  );
};
