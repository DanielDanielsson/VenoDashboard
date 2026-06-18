const INTERNAL_PREFIX = '__internal:';
const LEGACY_DASHBOARD_ADMIN_KEY_NAME = 'dashboard-admin-token';

export function isSystemApiKeyName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return (
    normalized.startsWith(INTERNAL_PREFIX) ||
    normalized === LEGACY_DASHBOARD_ADMIN_KEY_NAME
  );
}
