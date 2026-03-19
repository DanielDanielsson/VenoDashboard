import { AgentContextSchema, OpenApiSchema } from '@/lib/contracts/schemas';
import type { AgentContextDocument, ContractBundle, OpenApiDocument } from '@/lib/contracts/types';
import {
  CONTRACT_REVALIDATE_SECONDS,
  agentContextUrl,
  getApiBaseUrl,
  openApiUrl
} from '@/lib/contracts/constants';
import openApiSnapshot from '@content/contracts/openapi.snapshot.json';
import agentContextSnapshot from '@content/contracts/agent-context.snapshot.json';

async function fetchJson<T>(
  url: string,
  schema: { parse: (value: unknown) => T },
  fallback: unknown
): Promise<{ payload: T; source: 'remote' | 'snapshot' }> {
  try {
    const response = await fetch(url, {
      next: { revalidate: CONTRACT_REVALIDATE_SECONDS }
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const json = await response.json();
    return {
      payload: schema.parse(json),
      source: 'remote'
    };
  } catch {
    return {
      payload: schema.parse(fallback),
      source: 'snapshot'
    };
  }
}

export async function getContractBundle(): Promise<ContractBundle> {
  const [openApiResult, agentContextResult] = await Promise.all([
    fetchJson<OpenApiDocument>(openApiUrl(), { parse: (value) => OpenApiSchema.parse(value) as OpenApiDocument }, openApiSnapshot as OpenApiDocument),
    fetchJson<AgentContextDocument>(agentContextUrl(), AgentContextSchema, agentContextSnapshot)
  ]);

  const openApiServer = openApiResult.payload.servers?.[0]?.url || getApiBaseUrl();
  const lastUpdated =
    agentContextResult.payload.generatedAt ||
    String(openApiResult.payload.info?.['x-generatedAt'] || '') ||
    new Date().toISOString();

  return {
    openApi: {
      ...openApiResult.payload,
      servers: [{ url: openApiServer }]
    },
    agentContext: agentContextResult.payload,
    source: {
      openApi: openApiResult.source,
      agentContext: agentContextResult.source
    },
    lastUpdated
  };
}
