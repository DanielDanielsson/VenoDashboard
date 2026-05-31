import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const baseUrl = process.env.PULSE_API_BASE_URL?.trim() || 'http://localhost:3101';
const requireRemote = process.env.CONTRACT_REQUIRE_REMOTE === 'true';
const fetchAttempts = Number.parseInt(
  process.env.CONTRACT_FETCH_ATTEMPTS || (requireRemote ? '4' : '1'),
  10,
);
const fetchTimeoutMs = Number.parseInt(process.env.CONTRACT_FETCH_TIMEOUT_MS || '15000', 10);
const retryDelayMs = Number.parseInt(process.env.CONTRACT_FETCH_RETRY_DELAY_MS || '3000', 10);

const assertOpenApiContract = (value, source) => {
  if (!value || typeof value !== 'object') {
    throw new Error(`${source}: contract is not an object`);
  }

  if (typeof value.openapi !== 'string') {
    throw new Error(`${source}: missing openapi version`);
  }

  if (!value.paths || typeof value.paths !== 'object') {
    throw new Error(`${source}: missing paths object`);
  }
};

const assertAgentContext = (value, source) => {
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
};

const readJson = async (filePath) => {
  return JSON.parse(await readFile(filePath, 'utf8'));
};

const formatFetchError = (error) => {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
    return `${error.name}: ${error.message}${cause}`;
  }

  return String(error);
};

const fetchJson = async (url) => {
  let lastError;

  for (let attempt = 1; attempt <= fetchAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Remote request failed: ${url} (${response.status})`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt === fetchAttempts) {
        break;
      }

      console.warn(
        `contract fetch failed, retrying (${attempt}/${fetchAttempts}): ${url} (${formatFetchError(error)})`,
      );
      await delay(retryDelayMs * attempt);
    }
  }

  throw new Error(
    `Remote request failed after ${fetchAttempts} attempts: ${url} (${formatFetchError(lastError)})`,
  );
};

const validateRemoteContract = async (url, assertContract, source) => {
  try {
    const remoteContract = await fetchJson(url);
    assertContract(remoteContract, source);
    return true;
  } catch (error) {
    if (requireRemote) {
      throw error;
    }

    console.warn(
      `${source}: remote validation skipped because ${url} was unavailable (${formatFetchError(error)})`,
    );
    return false;
  }
};

const localOpenApi = await readJson('content/contracts/openapi.snapshot.json');
const localAgentContext = await readJson('content/contracts/agent-context.snapshot.json');
assertOpenApiContract(localOpenApi, 'local openapi snapshot');
assertAgentContext(localAgentContext, 'local agent context snapshot');

const remoteOpenApiValid = await validateRemoteContract(
  `${baseUrl}/docs/openapi.json`,
  assertOpenApiContract,
  'remote openapi',
);

let remoteAgentContextValid = false;
if (remoteOpenApiValid) {
  remoteAgentContextValid = await validateRemoteContract(
    `${baseUrl}/docs/agent-context.json`,
    assertAgentContext,
    'remote agent context',
  );
}

console.log(
  remoteOpenApiValid && remoteAgentContextValid
    ? 'contract validation passed'
    : 'contract snapshot validation passed',
);
