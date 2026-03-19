import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { fetchDexcomConnectLocation } from '@/lib/pulse-api/client';

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  try {
    const location = await fetchDexcomConnectLocation();
    return NextResponse.redirect(new URL(location));
  } catch (error) {
    const url = new URL('/dashboard/integrations', origin);
    url.searchParams.set('error', error instanceof Error ? error.message : 'Dexcom connect failed');
    return NextResponse.redirect(url);
  }
}
