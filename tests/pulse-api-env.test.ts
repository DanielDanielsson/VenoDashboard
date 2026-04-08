import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  getAdminApiToken,
  getApiAuthTokenCandidates,
  getApiBaseUrl,
  getDexcomGatewayAdminToken,
  getDexcomGatewayBaseUrl,
  getConsumerOrAdminApiToken,
  getStatusToken
} from '@/lib/pulse-api/env';

describe('pulse api env helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('ignores placeholder consumer key and falls back to admin token', () => {
    vi.stubEnv('PULSE_API_CONSUMER_KEY', 'replace_with_consumer_api_key_for_glucose_endpoints');
    vi.stubEnv('ADMIN_BEARER_TOKEN', 'admin-token');

    expect(getConsumerOrAdminApiToken()).toBe('admin-token');
  });

  test('reads the dashboard admin token from ADMIN_BEARER_TOKEN', () => {
    vi.stubEnv('ADMIN_BEARER_TOKEN', 'api-admin-bearer');

    expect(getAdminApiToken()).toBe('api-admin-bearer');
  });

  test('uses dexcom gateway admin token when configured', () => {
    vi.stubEnv('ADMIN_BEARER_TOKEN', 'api-admin-bearer');
    vi.stubEnv('DEXCOM_GATEWAY_ADMIN_TOKEN', 'gateway-admin-bearer');

    expect(getDexcomGatewayAdminToken()).toBe('gateway-admin-bearer');
  });

  test('returns consumer then admin token when both are configured', () => {
    vi.stubEnv('PULSE_API_CONSUMER_KEY', 'consumer-token');
    vi.stubEnv('ADMIN_BEARER_TOKEN', 'admin-token');

    expect(getApiAuthTokenCandidates()).toEqual(['consumer-token', 'admin-token']);
  });

  test('returns undefined status token when optional placeholder is set', () => {
    vi.stubEnv('PULSE_API_STATUS_TOKEN', 'optional_existing_status_page_token');

    expect(getStatusToken()).toBeUndefined();
  });

  test('reads required api base url', () => {
    vi.stubEnv('PULSE_API_BASE_URL', 'http://localhost:3101');

    expect(getApiBaseUrl()).toBe('http://localhost:3101');
  });

  test('uses dexcom gateway base url when configured', () => {
    vi.stubEnv('PULSE_API_BASE_URL', 'http://localhost:3101');
    vi.stubEnv('DEXCOM_GATEWAY_BASE_URL', 'https://glucose-nu.vercel.app');

    expect(getDexcomGatewayBaseUrl()).toBe('https://glucose-nu.vercel.app');
  });

  test('falls back to api base url when dexcom gateway base url is unset', () => {
    vi.stubEnv('PULSE_API_BASE_URL', 'http://localhost:3101');

    expect(getDexcomGatewayBaseUrl()).toBe('http://localhost:3101');
  });

  test('falls back to api admin token when dexcom gateway admin token is unset', () => {
    vi.stubEnv('ADMIN_BEARER_TOKEN', 'api-admin-bearer');

    expect(getDexcomGatewayAdminToken()).toBe('api-admin-bearer');
  });

  test('ignores unused aliases and uses the supported env names only', () => {
    vi.stubEnv('PULSE_API_BASE_URL', 'http://127.0.0.1:3101');
    vi.stubEnv('PULSE_API_ADMIN_TOKEN', 'stale-admin-token');
    vi.stubEnv('PULSE_API_CONSUMER_KEY', 'consumer-token');
    vi.stubEnv('ADMIN_BEARER_TOKEN', 'admin-token');

    expect(getApiBaseUrl()).toBe('http://127.0.0.1:3101');
    expect(getAdminApiToken()).toBe('admin-token');
    expect(getApiAuthTokenCandidates()).toEqual(['consumer-token', 'admin-token']);
  });
});
