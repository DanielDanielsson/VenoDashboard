import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OWNER_SESSION_COOKIE, ownerSessionCookieValue } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!isAllowedPath(pathname)) {
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    applyNoIndexHeaders(response);
    return response;
  }

  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('callbackUrl', callbackUrl);

  const expectedSession = await ownerSessionCookieValue();
  if (isProtectedPath(pathname) && request.cookies.get(OWNER_SESSION_COOKIE)?.value !== expectedSession) {
    const response = NextResponse.redirect(loginUrl);
    applyNoIndexHeaders(response);
    return response;
  }

  const response = NextResponse.next();
  applyNoIndexHeaders(response);
  return response;
}

function applyNoIndexHeaders(response: NextResponse): void {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
}

export function isProtectedPath(pathname: string): boolean {
  if (pathname !== '/dashboard' && !pathname.startsWith('/dashboard/')) {
    return false;
  }

  return pathname !== '/dashboard' && pathname !== '/dashboard/about';
}

export function isAllowedPath(pathname: string): boolean {
  const allowedPrefixes = [
    '/dashboards',
    '/dashboard',
    '/login',
    '/api/auth',
    '/api/dashboard',
    '/_next',
    '/static_assets',
    '/fonts'
  ];
  const allowedExact = ['/', '/favicon.ico', '/robots.txt', '/sitemap.xml'];

  if (allowedExact.includes(pathname)) {
    return true;
  }

  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return true;
  }

  return allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)']
};
