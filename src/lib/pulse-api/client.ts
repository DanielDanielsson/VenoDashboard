import type {
  AdminHealthStepBucketsResponse,
  ApiKeyCreateResponse,
  ApiKeyListResponse,
  CreateSharedTimerPayload,
  ConsumerProfileResponse,
  ConsumerProfileUpdatePayload,
  PulseApiErrorResponse,
  PulseApiStatusReport,
  SharedTimer,
  SharedTimerMutationResponse,
  SharedTimerListResponse
} from '@/lib/pulse-api/types';
import {
  getApiBaseUrl,
  getAdminApiToken,
  getDexcomGatewayAdminToken,
  getDexcomGatewayBaseUrl,
  getStatusToken
} from '@/lib/pulse-api/env';
import { fetchWithApiAuth } from '@/lib/pulse-api/auth-fetch';

export class PulseApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PulseApiClientError';
    this.status = status;
  }
}

function resolveUrl(path: string): string {
  return new URL(path, getApiBaseUrl()).toString();
}

function resolveGatewayUrl(path: string): string {
  return new URL(path, getDexcomGatewayBaseUrl()).toString();
}

async function parseJson<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new PulseApiClientError(response.status, 'Pulse API returned invalid JSON');
  }
}

async function parseError(response: Response): Promise<never> {
  let payload: PulseApiErrorResponse | null = null;

  try {
    payload = await parseJson<PulseApiErrorResponse>(response);
  } catch {
    payload = null;
  }

  const message = payload?.error?.message || `Pulse API request failed with status ${response.status}`;
  throw new PulseApiClientError(response.status, message);
}

function createAdminHeaders(extraHeaders: HeadersInit = {}): Headers {
  const headers = new Headers(extraHeaders);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${getAdminApiToken()}`);
  }
  return headers;
}

async function adminJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = createAdminHeaders(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(resolveUrl(path), {
    ...init,
    headers,
    cache: 'no-store'
  });

  if (!response.ok) {
    await parseError(response);
  }

  return parseJson<T>(response);
}

async function consumerJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetchWithApiAuth(resolveUrl(path), {
    ...init,
    headers,
    cache: 'no-store'
  });

  if (!response.ok) {
    await parseError(response);
  }

  return parseJson<T>(response);
}

export async function fetchApiStatus(): Promise<PulseApiStatusReport> {
  const headers = new Headers();
  const statusToken = getStatusToken();
  if (statusToken) {
    headers.set('x-status-token', statusToken);
  }

  const response = await fetch(resolveUrl('/api/status?format=json'), {
    headers,
    cache: 'no-store'
  });

  if (!response.ok) {
    await parseError(response);
  }

  return parseJson<PulseApiStatusReport>(response);
}

export async function fetchAdminHealthSteps(
  from: string,
  to: string
): Promise<AdminHealthStepBucketsResponse> {
  const url = new URL(resolveUrl('/api/admin/health/steps'));
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  const response = await fetch(url.toString(), {
    headers: createAdminHeaders(),
    cache: 'no-store'
  });

  if (!response.ok) {
    await parseError(response);
  }

  return parseJson<AdminHealthStepBucketsResponse>(response);
}

export async function fetchConsumerProfile(timezone?: string): Promise<ConsumerProfileResponse> {
  const headers = new Headers();
  if (timezone) {
    headers.set('x-user-timezone', timezone);
  }

  return adminJson<ConsumerProfileResponse>('/api/admin/settings/profile', {
    method: 'GET',
    headers
  });
}

export async function updateConsumerProfile(
  payload: ConsumerProfileUpdatePayload,
  timezone?: string
): Promise<ConsumerProfileResponse> {
  const headers = new Headers();
  if (timezone) {
    headers.set('x-user-timezone', timezone);
  }

  return adminJson<ConsumerProfileResponse>('/api/admin/settings/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });
}

export async function listApiKeys(): Promise<ApiKeyListResponse> {
  return adminJson<ApiKeyListResponse>('/api/admin/keys/list', {
    method: 'GET'
  });
}

export async function createApiKey(name: string): Promise<ApiKeyCreateResponse> {
  return adminJson<ApiKeyCreateResponse>('/api/admin/keys/create', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}

export async function revokeApiKey(id: string): Promise<void> {
  await adminJson('/api/admin/keys/revoke', {
    method: 'POST',
    body: JSON.stringify({ id })
  });
}

export async function fetchDexcomConnectLocation(): Promise<string> {
  const gatewayBaseUrl = getDexcomGatewayBaseUrl();
  const response = await fetch(resolveGatewayUrl('/api/auth/start'), {
    method: 'GET',
    headers: createAdminHeaders({
      Authorization: `Bearer ${getDexcomGatewayAdminToken()}`
    }),
    cache: 'no-store',
    redirect: 'manual'
  });

  if (response.status < 300 || response.status >= 400) {
    await parseError(response);
  }

  const location = response.headers.get('location');
  if (!location) {
    throw new PulseApiClientError(502, 'Pulse API did not return a Dexcom redirect location');
  }

  return location.startsWith('http') ? location : new URL(location, gatewayBaseUrl).toString();
}

export async function fetchSharedTimers(): Promise<SharedTimerListResponse> {
  return consumerJson<SharedTimerListResponse>('/api/v1/timers', {
    method: 'GET'
  });
}

export async function createSharedTimer(payload: CreateSharedTimerPayload): Promise<SharedTimer> {
  const response = await createSharedTimerMutation(payload);
  return response.timer;
}

export async function createSharedTimerMutation(
  payload: CreateSharedTimerPayload
): Promise<SharedTimerMutationResponse> {
  return consumerJson<SharedTimerMutationResponse>('/api/v1/timers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function removeSharedTimer(id: string): Promise<SharedTimer> {
  const response = await removeSharedTimerMutation(id);
  return response.timer;
}

export async function removeSharedTimerMutation(id: string): Promise<SharedTimerMutationResponse> {
  return consumerJson<SharedTimerMutationResponse>(`/api/v1/timers/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}
