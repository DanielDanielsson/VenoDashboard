const PLACEHOLDER_PREFIXES = ['replace_with_', 'optional_', 'your_'];

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (PLACEHOLDER_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return undefined;
  }

  return value;
}

export function getRequiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}

export function getApiBaseUrl(): string {
  return getRequiredEnv('PULSE_API_BASE_URL');
}

export function getDexcomGatewayBaseUrl(): string {
  return readEnv('DEXCOM_GATEWAY_BASE_URL') || getApiBaseUrl();
}

export function getAdminApiToken(): string {
  const token = readEnv('ADMIN_BEARER_TOKEN');
  if (!token) {
    throw new Error('Missing dashboard API admin token. Set ADMIN_BEARER_TOKEN.');
  }

  return token;
}

export function hasAdminApiToken(): boolean {
  return Boolean(readEnv('ADMIN_BEARER_TOKEN'));
}

export function getDexcomGatewayAdminToken(): string {
  return readEnv('DEXCOM_GATEWAY_ADMIN_TOKEN') || getAdminApiToken();
}

export function getConsumerApiToken(): string | undefined {
  return readEnv('PULSE_API_CONSUMER_KEY');
}

export function getApiAuthTokenCandidates(): string[] {
  const consumerToken = getConsumerApiToken();
  const adminToken = readEnv('ADMIN_BEARER_TOKEN');

  if (consumerToken && adminToken && consumerToken !== adminToken) {
    return [consumerToken, adminToken];
  }

  if (consumerToken) {
    return [consumerToken];
  }

  if (adminToken) {
    return [adminToken];
  }

  throw new Error(
    'Missing dashboard API token. Set PULSE_API_CONSUMER_KEY or ADMIN_BEARER_TOKEN.'
  );
}

export function getConsumerOrAdminApiToken(): string {
  return getApiAuthTokenCandidates()[0];
}

export function getStatusToken(): string | undefined {
  return readEnv('PULSE_API_STATUS_TOKEN');
}
