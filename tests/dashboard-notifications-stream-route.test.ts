import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const getOwnerSession = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOwnerSession
}));

describe('dashboard notifications stream route', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
    vi.stubGlobal('fetch', fetchMock);
    process.env.PULSE_API_BASE_URL = 'https://glucose.example';
    process.env.PULSE_API_CONSUMER_KEY = 'consumer-token';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test('rejects unauthorized requests', async () => {
    getOwnerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/dashboard/notifications/stream/route');
    const response = await GET(new Request('http://localhost/api/dashboard/notifications/stream'));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.message).toContain('Unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('proxies the notifications SSE endpoint with bearer auth and afterSeq', async () => {
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream(), {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8'
        }
      })
    );

    const { GET } = await import('@/app/api/dashboard/notifications/stream/route');
    const response = await GET(new Request('http://localhost/api/dashboard/notifications/stream?afterSeq=42'));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://glucose.example/api/v1/notifications/stream?afterSeq=42');
    expect(init.cache).toBe('no-store');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer consumer-token');
    expect((init.headers as Headers).get('Accept')).toBe('text/event-stream');
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
  });
});
