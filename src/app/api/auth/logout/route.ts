import { NextResponse } from 'next/server';
import { OWNER_SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: OWNER_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0)
  });

  return response;
}
