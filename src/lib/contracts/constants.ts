export const DEFAULT_API_BASE_URL = 'http://localhost:3101';
export const CONTRACT_REVALIDATE_SECONDS = 600;

export function getApiBaseUrl(): string {
  return process.env.PULSE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
}

export function openApiUrl(): string {
  return `${getApiBaseUrl()}/docs/openapi.json`;
}

export function agentContextUrl(): string {
  return `${getApiBaseUrl()}/docs/agent-context.json`;
}
