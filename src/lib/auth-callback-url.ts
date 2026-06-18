export const DEFAULT_AUTH_CALLBACK_URL = '/dashboard';
export const PUBLIC_DASHBOARD_FALLBACK_URL = '/dashboards';

const LOCAL_URL_ORIGIN = 'https://app.veno.local';

function readLocalPath(value: string | undefined, fallbackUrl: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallbackUrl;
  }

  let url: URL;
  try {
    url = new URL(value, LOCAL_URL_ORIGIN);
  } catch {
    return fallbackUrl;
  }

  try {
    decodeURI(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return fallbackUrl;
  }

  if (url.pathname === '/login' || url.pathname.startsWith('/api/auth')) {
    return fallbackUrl;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function normalizeAuthCallbackUrl(
  value: string | undefined,
  fallbackUrl = DEFAULT_AUTH_CALLBACK_URL,
): string {
  return readLocalPath(value, fallbackUrl);
}

export function getLoginCloseUrl(callbackUrl: string | undefined): string {
  const normalizedUrl = readLocalPath(callbackUrl, PUBLIC_DASHBOARD_FALLBACK_URL);
  const url = new URL(normalizedUrl, LOCAL_URL_ORIGIN);

  if (
    url.pathname === '/dashboard'
    || url.pathname === '/'
    || url.pathname.startsWith('/api/')
  ) {
    return PUBLIC_DASHBOARD_FALLBACK_URL;
  }

  if (
    url.pathname === '/dashboard/about'
    || url.pathname === '/dashboards'
    || url.pathname.startsWith('/dashboards/')
  ) {
    return normalizedUrl;
  }

  return PUBLIC_DASHBOARD_FALLBACK_URL;
}
