import {
  DASHBOARDS_EXPANDED_EVENT,
  DASHBOARDS_EXPANDED_STORAGE_KEY,
  SIDEBAR_EVENT,
  SIDEBAR_STORAGE_KEY,
} from './const';

export function readSidebarCollapsedSnapshot(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

export function subscribeToSidebarPreference(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === SIDEBAR_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(SIDEBAR_EVENT, callback);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(SIDEBAR_EVENT, callback);
    window.removeEventListener('storage', handleStorage);
  };
}

export function setSidebarCollapsedPreference(collapsed: boolean): void {
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

export function readDashboardsExpandedSnapshot(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(DASHBOARDS_EXPANDED_STORAGE_KEY) !== 'false';
}

export function subscribeToDashboardsExpandedPreference(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === DASHBOARDS_EXPANDED_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(DASHBOARDS_EXPANDED_EVENT, callback);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(DASHBOARDS_EXPANDED_EVENT, callback);
    window.removeEventListener('storage', handleStorage);
  };
}

export function setDashboardsExpandedPreference(expanded: boolean): void {
  window.localStorage.setItem(DASHBOARDS_EXPANDED_STORAGE_KEY, String(expanded));
  window.dispatchEvent(new Event(DASHBOARDS_EXPANDED_EVENT));
}
