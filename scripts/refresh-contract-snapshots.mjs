import { writeFile } from 'node:fs/promises';

const baseUrl = process.env.PULSE_API_BASE_URL?.trim() || 'http://localhost:3101';
const targets = [
  {
    url: `${baseUrl}/docs/openapi.json`,
    outputPath: 'content/contracts/openapi.snapshot.json'
  },
  {
    url: `${baseUrl}/docs/agent-context.json`,
    outputPath: 'content/contracts/agent-context.snapshot.json'
  }
];

async function refreshTarget(target) {
  try {
    const response = await fetch(target.url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    const json = await response.json();
    await writeFile(target.outputPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
    console.log(`updated ${target.outputPath}`);
  } catch (error) {
    console.warn(`kept existing ${target.outputPath}: ${String(error)}`);
  }
}

await Promise.all(targets.map((target) => refreshTarget(target)));
