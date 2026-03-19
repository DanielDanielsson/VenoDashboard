import type { AgentContextDocument, CodeSamples, NormalizedEndpoint, OpenApiDocument, OpenApiOperation } from '@/lib/contracts/types';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function isConsumerPath(path: string): boolean {
  if (path.startsWith('/api/admin') || path.startsWith('/api/auth') || path.startsWith('/api/cron')) {
    return false;
  }

  return path.startsWith('/api/v1') || path === '/api/health';
}

function getGroup(path: string): string {
  if (path.startsWith('/api/v1/share/glucose')) return 'Share Glucose';
  if (path.startsWith('/api/v1/glucose')) return 'Official Glucose';
  if (path.startsWith('/api/v1/events')) return 'Events';
  if (path.startsWith('/api/v1/notifications')) return 'Notifications';
  if (path.startsWith('/api/v1/profile')) return 'Profile';
  if (path.startsWith('/api/v1/stream')) return 'Streams';
  return 'Core';
}

function detectSource(path: string): string {
  if (path.includes('/share/')) return 'share';
  if (path.includes('/events') || path.includes('/glucose')) return 'official';
  return 'mixed';
}

function detectAuth(operation: OpenApiOperation): string {
  if (operation.security && operation.security.length > 0) {
    return 'Bearer API key';
  }

  return 'None';
}

function pickExample(
  content?: Record<string, { example?: unknown; examples?: Record<string, { value?: unknown }> }>
): unknown {
  if (!content) return null;

  const json = content['application/json'];
  if (!json) return null;
  if (json.example !== undefined) return json.example;

  if (json.examples) {
    const firstExample = Object.values(json.examples)[0];
    if (firstExample && firstExample.value !== undefined) return firstExample.value;
  }

  return null;
}

function createId(method: string, path: string): string {
  return `${method.toLowerCase()}-${path.replaceAll('/', '-').replaceAll('{', '').replaceAll('}', '')}`;
}

function codeSamples(baseUrl: string, method: string, path: string): CodeSamples {
  const fullUrl = `${baseUrl}${path}`;
  const hasBody = method !== 'GET';

  const curl = [
    `curl -X ${method} "${fullUrl}"`,
    '  -H "Authorization: Bearer <apiKey>"',
    '  -H "Content-Type: application/json"',
    hasBody ? "  -d '{\"example\":true}'" : ''
  ]
    .filter(Boolean)
    .join(' \\\n');

  const javascript = `const response = await fetch('${fullUrl}', {
  method: '${method}',
  headers: {
    Authorization: 'Bearer <apiKey>',
    'Content-Type': 'application/json'
  }${
    hasBody
      ? ",\n  body: JSON.stringify({\n    example: true\n  })"
      : ''
  }
});

if (!response.ok) {
  throw new Error('Request failed: ' + response.status);
}

const data = await response.json();
console.log(data);`;

  const python = `import requests

url = '${fullUrl}'
headers = {
    'Authorization': 'Bearer <apiKey>',
    'Content-Type': 'application/json'
}
payload = {'example': True}
response = requests.${method.toLowerCase()}(
    url,
    headers=headers${hasBody ? ',\n    json=payload' : ''}
)
response.raise_for_status()
print(response.json())`;

  return { curl, javascript, python };
}

export function normalizeEndpoints(
  openApi: OpenApiDocument,
  agentContext: AgentContextDocument
): NormalizedEndpoint[] {
  const baseUrl = openApi.servers?.[0]?.url || agentContext.baseUrl;
  const errorCodes = agentContext.errorCodes ?? [];

  const result: NormalizedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(openApi.paths || {})) {
    if (!pathItem || !isConsumerPath(path)) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const queryParams = (operation.parameters || [])
        .filter((param) => param && param.in === 'query')
        .map((param) => ({
          name: param.name,
          required: Boolean(param.required),
          description: param.description || ''
        }));

      const successResponse = operation.responses?.['200'] || operation.responses?.['201'];
      const responseExample = successResponse ? pickExample(successResponse.content) : null;

      const endpoint: NormalizedEndpoint = {
        id: createId(method.toUpperCase(), path),
        group: getGroup(path),
        method: method.toUpperCase(),
        path,
        summary: operation.summary || `${method.toUpperCase()} ${path}`,
        description: operation.description || '',
        auth: detectAuth(operation),
        queryParams,
        requestExample: pickExample(operation.requestBody?.content),
        responseExample,
        errorCodes,
        source: detectSource(path),
        codeSamples: codeSamples(baseUrl, method.toUpperCase(), path)
      };

      result.push(endpoint);
    }
  }

  return result.sort((a, b) => {
    if (a.group === b.group) {
      if (a.path === b.path) {
        return a.method.localeCompare(b.method);
      }
      return a.path.localeCompare(b.path);
    }
    return a.group.localeCompare(b.group);
  });
}

export function groupEndpoints(endpoints: NormalizedEndpoint[]): Map<string, NormalizedEndpoint[]> {
  const grouped = new Map<string, NormalizedEndpoint[]>();

  for (const endpoint of endpoints) {
    const existing = grouped.get(endpoint.group) || [];
    grouped.set(endpoint.group, [...existing, endpoint]);
  }

  return grouped;
}
