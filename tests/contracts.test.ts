import { describe, expect, test, vi } from 'vitest';

describe('contract bundle', () => {
  test('uses snapshot fallback when remote fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    const { getContractBundle } = await import('@/lib/contracts/fetch-contracts');
    const bundle = await getContractBundle();

    expect(bundle.source.openApi).toBe('snapshot');
    expect(bundle.source.agentContext).toBe('snapshot');
    expect(bundle.openApi.openapi).toBeTypeOf('string');
    expect(bundle.agentContext.version).toBeTypeOf('string');
  });

  test('normalizes endpoints and filters admin routes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const value = String(url);

        if (value.endsWith('/openapi.json')) {
          return {
            ok: true,
            json: async () => ({
              openapi: '3.1.0',
              paths: {
                '/api/v1/share/glucose/latest': {
                  get: {
                    summary: 'Share latest',
                    security: [{ ApiKeyAuth: [] }],
                    responses: { '200': { description: 'ok' } }
                  }
                },
                '/api/admin/keys': {
                  post: {
                    summary: 'Admin only',
                    responses: { '200': { description: 'ok' } }
                  }
                }
              }
            })
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            version: '1.0.0',
            generatedAt: '2026-03-01T10:00:00.000Z',
            baseUrl: 'https://api.your-domain.com',
            scope: 'consumer',
            endpoints: [],
            errorCodes: [],
            sourceGuidance: []
          })
        } as Response;
      })
    );

    const { getDocsData } = await import('@/lib/contracts');
    const data = await getDocsData();

    expect(data.endpoints.length).toBe(1);
    expect(data.endpoints[0].path).toBe('/api/v1/share/glucose/latest');
    expect(data.endpoints[0].codeSamples.curl).toContain('/api/v1/share/glucose/latest');
  });
});
