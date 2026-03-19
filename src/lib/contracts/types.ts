export interface OpenApiOperation {
  summary?: string;
  description?: string;
  security?: Array<Record<string, unknown>>;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    description?: string;
  }>;
  requestBody?: {
    content?: Record<string, { example?: unknown; examples?: Record<string, { value?: unknown }> }>;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, { example?: unknown; examples?: Record<string, { value?: unknown }> }>;
    }
  >;
}

export interface OpenApiDocument {
  openapi: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
    [key: string]: unknown;
  };
  servers?: Array<{ url: string }>;
  paths: Record<string, Record<string, OpenApiOperation>>;
  [key: string]: unknown;
}

export interface AgentContextEndpoint {
  id: string;
  method: string;
  path: string;
  scope?: string;
  summary?: string;
  auth?: string;
  source?: string;
  tags?: string[];
}

export interface AgentContextErrorCode {
  code: string;
  status: number;
  message?: string;
  action?: string;
}

export interface AgentContextDocument {
  version: string;
  generatedAt: string;
  baseUrl: string;
  scope: string;
  endpoints: AgentContextEndpoint[];
  errorCodes: AgentContextErrorCode[];
  sourceGuidance: Array<{
    source: string;
    guidance: string;
  }>;
}

export interface CodeSamples {
  curl: string;
  javascript: string;
  python: string;
}

export interface NormalizedEndpoint {
  id: string;
  group: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  auth: string;
  queryParams: Array<{
    name: string;
    required: boolean;
    description: string;
  }>;
  requestExample: unknown;
  responseExample: unknown;
  errorCodes: AgentContextErrorCode[];
  source: string;
  codeSamples: CodeSamples;
}

export interface ContractBundle {
  openApi: OpenApiDocument;
  agentContext: AgentContextDocument;
  source: {
    openApi: 'remote' | 'snapshot';
    agentContext: 'remote' | 'snapshot';
  };
  lastUpdated: string;
}
