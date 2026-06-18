import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchWithApiAuth } from '@/lib/veno-api/auth-fetch';

describe('veno api auth fetch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('uses consumer token when request succeeds', async () => {
    vi.stubEnv('PULSE_API_CONSUMER_KEY', 'consumer-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL, init?: RequestInit) => {
        expect((init?.headers as Headers).get('Authorization')).toBe('Bearer consumer-token');
        return new Response('{}', { status: 200 });
      })
    );

    const response = await fetchWithApiAuth('https://example.test/health');

    expect(response.status).toBe(200);
  });

  test('retries with admin token when consumer token is rejected', async () => {
    vi.stubEnv('PULSE_API_CONSUMER_KEY', 'consumer-token');
    vi.stubEnv('ADMIN_BEARER_TOKEN', 'admin-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithApiAuth('https://example.test/data');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get('Authorization')).toBe(
      'Bearer consumer-token'
    );
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get('Authorization')).toBe(
      'Bearer admin-token'
    );
  });
});
