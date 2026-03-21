import { NextResponse } from 'next/server';
import { getApiBaseUrl, getConsumerOrAdminApiToken } from '@/lib/pulse-api/env';

export const dynamic = 'force-dynamic';

function resolveStreamUrl(): string {
  return new URL('/api/v1/timers/stream', getApiBaseUrl()).toString();
}

function createStreamHeaders(): Headers {
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${getConsumerOrAdminApiToken()}`);
  headers.set('Accept', 'text/event-stream');
  return headers;
}

export async function GET(request: Request) {
  const controller = new AbortController();
  request.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await fetch(resolveStreamUrl(), {
      method: 'GET',
      headers: createStreamHeaders(),
      cache: 'no-store',
      signal: controller.signal
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: { message: `Timer stream failed with status ${upstream.status}` } },
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
      { error: { message: error instanceof Error ? error.message : 'Failed to connect timer stream' } },
      { status: 502 }
    );
  }
}
