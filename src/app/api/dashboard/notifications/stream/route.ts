import { NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { getApiBaseUrl, getConsumerOrAdminApiToken } from '@/lib/veno-api/env';

export const dynamic = 'force-dynamic';

function resolveStreamUrl(request: Request): string {
  const incomingUrl = new URL(request.url);
  const url = new URL('/api/v1/notifications/stream', getApiBaseUrl());
  const afterSeq = incomingUrl.searchParams.get('afterSeq')?.trim();
  if (afterSeq) {
    url.searchParams.set('afterSeq', afterSeq);
  }

  return url.toString();
}

function createStreamHeaders(): Headers {
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${getConsumerOrAdminApiToken()}`);
  headers.set('Accept', 'text/event-stream');
  return headers;
}

export async function GET(request: Request) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const controller = new AbortController();
  request.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(resolveStreamUrl(request), {
      method: 'GET',
      headers: createStreamHeaders(),
      cache: 'no-store',
      signal: controller.signal
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: { message: `Notification stream failed with status ${upstream.status}` } },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', 'text/event-stream; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-transform');
    headers.set('Connection', 'keep-alive');
    headers.set('X-Accel-Buffering', 'no');

    return new Response(upstream.body, {
      status: 200,
      headers
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to connect notification stream' } },
      { status: 502 }
    );
  }
}
