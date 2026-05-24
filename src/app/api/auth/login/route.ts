import { NextRequest, NextResponse } from 'next/server';
import {
  OWNER_SESSION_COOKIE,
  hasOwnerCredentialsConfigured,
  ownerSessionCookieValue,
  validateOwnerCredentials
} from '@/lib/auth';
import { normalizeAuthCallbackUrl } from '@/lib/auth-callback-url';
import { applyRateLimit, createRateLimitResponse, getClientIp } from '@/lib/security/rate-limit';

interface LoginPayload {
  callbackUrl?: string;
  username?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  const rateLimit = applyRateLimit({
    key: `login:${getClientIp(request)}`,
    limit: 10,
    windowMs: 5 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, 'Too many login attempts. Try again in a few minutes.');
  }

  const payload = (await request.json().catch(() => ({}))) as LoginPayload;
  const callbackUrl = normalizeAuthCallbackUrl(payload.callbackUrl);
  const username = payload.username?.trim() || '';
  const password = payload.password || '';

  if (!hasOwnerCredentialsConfigured()) {
    return NextResponse.json(
      { error: { message: 'Admin credentials are not configured.' } },
      { status: 500 }
    );
  }

  if (!validateOwnerCredentials(username, password)) {
    return NextResponse.json(
      { error: { message: 'Invalid username or password.' } },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ callbackUrl }, { status: 200 });
  response.cookies.set({
    name: OWNER_SESSION_COOKIE,
    value: await ownerSessionCookieValue(),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: request.nextUrl.protocol === 'https:'
  });

  return response;
}
