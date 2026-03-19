import { readFile } from 'node:fs/promises';

const baseUrl = process.env.PULSE_API_BASE_URL?.trim() || 'http://localhost:3101';

function assertOpenApiContract(value, source) {
  if (!value || typeof value !== 'object') {
    throw new Error(`${source}: contract is not an object`);
  }

  if (typeof value.openapi !== 'string') {
    throw new Error(`${source}: missing openapi version`);
  }

  if (!value.paths || typeof value.paths !== 'object') {
    throw new Error(`${source}: missing paths object`);
  }
}

function assertAgentContext(value, source) {
  if (!value || typeof value !== 'object') {
    throw new Error(`${source}: agent context is not an object`);
  }

  const required = ['version', 'generatedAt', 'baseUrl', 'scope', 'endpoints', 'errorCodes', 'sourceGuidance'];
  for (const key of required) {
    if (!(key in value)) {
      throw new Error(`${source}: missing ${key}`);
    }
  }

  if (!Array.isArray(value.endpoints) || !Array.isArray(value.errorCodes)) {
    throw new Error(`${source}: endpoints and errorCodes must be arrays`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Remote request failed: ${url} (${response.status})`);
  }
  return response.json();
}

const localOpenApi = await readJson('content/contracts/openapi.snapshot.json');
const localAgentContext = await readJson('content/contracts/agent-context.snapshot.json');
assertOpenApiContract(localOpenApi, 'local openapi snapshot');
assertAgentContext(localAgentContext, 'local agent context snapshot');

const remoteOpenApi = await fetchJson(`${baseUrl}/docs/openapi.json`);
const remoteAgentContext = await fetchJson(`${baseUrl}/docs/agent-context.json`);
assertOpenApiContract(remoteOpenApi, 'remote openapi');
assertAgentContext(remoteAgentContext, 'remote agent context');

console.log('contract validation passed');
