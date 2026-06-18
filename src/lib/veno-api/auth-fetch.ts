import { getApiAuthTokenCandidates } from '@/lib/veno-api/env';

const AUTH_RETRY_STATUSES = new Set([401, 403]);

export async function fetchWithApiAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const tokens = getApiAuthTokenCandidates();
  let lastResponse: Response | null = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${tokens[index]}`);

    const response = await fetch(url, {
      ...init,
      headers,
      cache: init.cache ?? 'no-store'
    });

    lastResponse = response;

    const hasFallback = index < tokens.length - 1;
    if (hasFallback && AUTH_RETRY_STATUSES.has(response.status)) {
      continue;
    }

    return response;
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw new Error('No API auth tokens configured');
}
