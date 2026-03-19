import { NextRequest, NextResponse } from 'next/server';
import { OWNER_SESSION_COOKIE, ownerSessionCookieValue } from '@/lib/auth';

interface LoginPayload {
  callbackUrl?: string;
}

function safeCallbackUrl(request: NextRequest, value: string | undefined): string {
  if (!value || !value.startsWith('/')) {
    return '/dashboard';
  }

  const url = new URL(value, request.url);
  return `${url.pathname}${url.search}`;
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as LoginPayload;
  const callbackUrl = safeCallbackUrl(request, payload.callbackUrl);

  const response = NextResponse.json({ callbackUrl }, { status: 200 });
  response.cookies.set({
    name: OWNER_SESSION_COOKIE,
    value: ownerSessionCookieValue(),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: request.nextUrl.protocol === 'https:'
  });

  return response;
}
