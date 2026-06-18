import type {
  AdminHealthStepBucketsResponse,
  ApiKeyCreateResponse,
  ApiKeyListResponse,
  CreateSharedTimerPayload,
  ConsumerProfileResponse,
  ConsumerProfileUpdatePayload,
  DashboardSettingsSavePayload,
  VenoApiErrorResponse,
  VenoApiStatusReport,
  SharedTimer,
  SharedTimerMutationResponse,
  SharedTimerListResponse
} from '@/lib/veno-api/types';
import type { DashboardSettingsResponse } from '@/lib/dashboard/settings';
import type { DashboardDefinition, DashboardType } from '@/lib/dashboard/schema';
import type { DashboardDescriptionDocument, DashboardIconName } from '@/lib/dashboard/metadata';
import type { TimeRange } from '@/lib/glucose/time-ranges';
import {
  getApiBaseUrl,
  getAdminApiToken,
  getDexcomGatewayAdminToken,
  getDexcomGatewayBaseUrl,
  getStatusToken
} from '@/lib/veno-api/env';
import { fetchWithApiAuth } from '@/lib/veno-api/auth-fetch';

export class VenoApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'VenoApiClientError';
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
    throw new VenoApiClientError(response.status, 'VenoAPI returned invalid JSON');
  }
}

async function parseError(response: Response): Promise<never> {
  let payload: VenoApiErrorResponse | null = null;

  try {
    payload = await parseJson<VenoApiErrorResponse>(response);
  } catch {
    payload = null;
  }

  const message = payload?.error?.message || `VenoAPI request failed with status ${response.status}`;
  throw new VenoApiClientError(response.status, message);
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

export async function fetchApiStatus(): Promise<VenoApiStatusReport> {
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

  return parseJson<VenoApiStatusReport>(response);
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

export async function saveDashboardSettings(
  dashboardUid: string,
  payload: DashboardSettingsSavePayload,
): Promise<DashboardSettingsResponse> {
  return adminJson<DashboardSettingsResponse>(
    `/api/admin/dashboard-settings/${encodeURIComponent(dashboardUid)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchDashboardSettings(dashboardUid: string): Promise<DashboardSettingsResponse> {
  return adminJson<DashboardSettingsResponse>(
    `/api/admin/dashboard-settings/${encodeURIComponent(dashboardUid)}`,
    {
      method: 'GET',
    },
  );
}

export interface DashboardResourceRecord {
  uid: string;
  title: string;
  description: DashboardDescriptionDocument | null;
  icon: DashboardIconName | null;
  defaultTimeRange: TimeRange | null;
  type: DashboardType;
  version: number;
  dashboard: DashboardDefinition;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardResourceResponse {
  dashboard: DashboardResourceRecord;
}

export interface DashboardResourceRedirectResponse {
  redirect: {
    dashboardUid: string;
  };
}

export interface DashboardCreatePayload {
  title: string;
  description?: DashboardDescriptionDocument | null;
  icon?: DashboardIconName | null;
  defaultTimeRange?: TimeRange | null;
  type: DashboardType;
}

export interface DashboardMetadataUpdatePayload {
  title: string;
  description: DashboardDescriptionDocument | null;
  icon?: DashboardIconName | null;
  defaultTimeRange?: TimeRange | null;
  expectedVersion: number;
}

export interface DashboardListResponse {
  dashboards: DashboardResourceRecord[];
}

export interface DashboardPreferencesRecord {
  homeDashboardUid: string | null;
  pinnedDashboardUids: string[];
  dashboardOrderUids: string[];
}

export interface DashboardPreferencesResponse {
  preferences: DashboardPreferencesRecord;
}

export async function fetchDashboardResource(
  dashboardUid: string,
): Promise<DashboardResourceResponse | DashboardResourceRedirectResponse> {
  const response = await fetch(resolveUrl(`/api/v1/dashboards/${encodeURIComponent(dashboardUid)}`), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    await parseError(response);
  }

  return parseJson<DashboardResourceResponse | DashboardResourceRedirectResponse>(response);
}

export async function fetchDashboardList(): Promise<DashboardListResponse> {
  const response = await fetch(resolveUrl('/api/v1/dashboards'), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    await parseError(response);
  }

  return parseJson<DashboardListResponse>(response);
}

export async function createDashboard(payload: DashboardCreatePayload): Promise<DashboardResourceResponse> {
  return adminJson<DashboardResourceResponse>('/api/admin/dashboards', {
    method: 'POST',
    body: JSON.stringify({ dashboard: payload }),
  });
}

export async function updateDashboardMetadata(
  dashboardUid: string,
  payload: DashboardMetadataUpdatePayload,
): Promise<DashboardResourceResponse & {
  previousUid?: string;
  preferences?: DashboardPreferencesRecord;
}> {
  return adminJson<DashboardResourceResponse & {
    previousUid?: string;
    preferences?: DashboardPreferencesRecord;
  }>(
    `/api/admin/dashboards/${encodeURIComponent(dashboardUid)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ dashboard: payload }),
    },
  );
}

export async function deleteDashboard(dashboardUid: string): Promise<{
  dashboardUid: string;
  preferences: DashboardPreferencesRecord;
}> {
  return adminJson<{
    dashboardUid: string;
    preferences: DashboardPreferencesRecord;
  }>(
    `/api/admin/dashboards/${encodeURIComponent(dashboardUid)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function fetchDashboardPreferences(): Promise<DashboardPreferencesResponse> {
  const response = await fetch(resolveUrl('/api/v1/dashboard-preferences'), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    await parseError(response);
  }

  return parseJson<DashboardPreferencesResponse>(response);
}

export async function saveDashboardPreferences(
  preferences: DashboardPreferencesRecord,
): Promise<DashboardPreferencesResponse> {
  return adminJson<DashboardPreferencesResponse>('/api/admin/dashboard-preferences', {
    method: 'PUT',
    body: JSON.stringify({ preferences }),
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
    throw new VenoApiClientError(502, 'VenoAPI did not return a Dexcom redirect location');
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
