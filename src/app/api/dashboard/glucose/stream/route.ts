import { NextResponse } from 'next/server';
import { getApiAuthTokenCandidates, getApiBaseUrl } from '@/lib/pulse-api/env';

export const dynamic = 'force-dynamic';

function resolveStreamUrl(): string {
  const url = new URL('/api/v1/stream/glucose', getApiBaseUrl());
  url.searchParams.set('source', 'share');
  return url.toString();
}

function createStreamHeaders(token: string): Headers {
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'text/event-stream');
  return headers;
}

async function connectGlucoseStream(
  url: string,
  signal: AbortSignal
): Promise<Response> {
  const tokens = getApiAuthTokenCandidates();
  let lastResponse: Response | null = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: createStreamHeaders(tokens[index]),
      cache: 'no-store',
      signal
    });

    lastResponse = upstream;
    const hasFallback = index < tokens.length - 1;
    if (hasFallback && (upstream.status === 401 || upstream.status === 403)) {
      continue;
    }

    return upstream;
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw new Error('Failed to connect glucose stream');
}

export async function GET(request: Request) {
  const controller = new AbortController();
  request.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const upstream = await connectGlucoseStream(resolveStreamUrl(), controller.signal);

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: { message: `Glucose stream failed with status ${upstream.status}` } },
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
      { error: { message: error instanceof Error ? error.message : 'Failed to connect glucose stream' } },
      { status: 502 }
    );
  }
}
