import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const routeRoots = ['src/app'];
const contentRoots = ['src/app', 'content'];

async function walk(dir) {
  const output = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await walk(fullPath)));
      continue;
    }
    output.push(fullPath);
  }

  return output;
}

function normalizeRoute(filePath) {
  return filePath
    .replace(/^src\/app\//, '')
    .replace(/\/(page|route)\.(tsx|mdx|ts)$/, '')
    .replace(/\/index$/, '');
}

function toRoutePath(segment) {
  const route = segment === '' ? '/' : `/${segment}`;
  return route.endsWith('/') && route !== '/' ? route.slice(0, -1) : route;
}

function routePattern(route) {
  const escaped = route
    .split('/')
    .map((segment) => {
      if (segment.startsWith('[') && segment.endsWith(']')) {
        return '[^/]+';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return new RegExp(`^${escaped}$`);
}

const routeFiles = (await Promise.all(routeRoots.map((root) => walk(root))))
  .flat()
  .filter((file) => /\/(page\.(tsx|mdx)|route\.ts)$/.test(file));

const staticRoutes = new Set();
const dynamicRoutePatterns = [];

for (const routeFile of routeFiles) {
  const route = toRoutePath(normalizeRoute(routeFile));
  if (route.includes('[')) {
    dynamicRoutePatterns.push(routePattern(route));
  } else {
    staticRoutes.add(route);
  }
}

const contentFiles = (await Promise.all(contentRoots.map((root) => walk(root))))
  .flat()
  .filter((file) => /\.(tsx|mdx)$/.test(file));

const hrefRegex = /href=\"(\/[^"]*)\"/g;
const failures = [];

for (const filePath of contentFiles) {
  const source = await readFile(filePath, 'utf8');
  const links = [...source.matchAll(hrefRegex)].map((match) => match[1]);

  for (const link of links) {
    if (link.startsWith('//')) continue;

    const normalized = link.endsWith('/') && link !== '/' ? link.slice(0, -1) : link;
    if (/\.[a-zA-Z0-9]+$/.test(normalized)) continue;
    if (normalized.startsWith('/static_assets/') || normalized.startsWith('/fonts/')) continue;
    const isStatic = staticRoutes.has(normalized);
    const isDynamic = dynamicRoutePatterns.some((pattern) => pattern.test(normalized));

    if (!isStatic && !isDynamic) {
      failures.push(`${filePath}: ${link}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Broken internal links found:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Internal links check passed');
