import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  getAdminApiToken,
  getApiAuthTokenCandidates,
  getApiBaseUrl,
  getConsumerOrAdminApiToken,
  getStatusToken
} from '@/lib/pulse-api/env';

describe('pulse api env helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('ignores placeholder consumer key and falls back to admin token', () => {
    vi.stubEnv('PULSE_API_CONSUMER_KEY', 'replace_with_consumer_api_key_for_glucose_endpoints');
    vi.stubEnv('PULSE_API_ADMIN_TOKEN', 'admin-token');

    expect(getConsumerOrAdminApiToken()).toBe('admin-token');
  });

  test('falls back to ADMIN_BEARER_TOKEN when dashboard admin token is placeholder', () => {
    vi.stubEnv('PULSE_API_ADMIN_TOKEN', 'replace_with_existing_api_admin_bearer_token');
    vi.stubEnv('ADMIN_BEARER_TOKEN', 'api-admin-bearer');

    expect(getAdminApiToken()).toBe('api-admin-bearer');
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
});
