'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'pulse-theme';
type Theme = 'light' | 'dark';
const THEME_EVENT = 'pulse-theme-change';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

function readThemeSnapshot(): Theme {
  if (typeof document === 'undefined') {
    return 'dark';
  }

  return document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light';
}

function subscribeToTheme(callback: () => void): () => void {
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
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, readThemeSnapshot, () => 'dark');

  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      <span className="theme-toggle__track">
        <span className="theme-toggle__label">{theme}</span>
        <span className="theme-toggle__thumb" aria-hidden="true">
          {theme === 'dark' ? '◐' : '◑'}
        </span>
      </span>
    </button>
  );
}
