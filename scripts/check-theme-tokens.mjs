import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CSS_ROOTS = ['src', 'ui'];
const CLASS_ROOTS = ['src', 'ui'];
const FILE_EXTENSIONS = new Set(['.css', '.tsx', '.ts', '.jsx', '.js']);
const COLOR_UTILITIES = new Set([
  'accent',
  'bg',
  'border',
  'caret',
  'decoration',
  'divide',
  'outline',
  'placeholder',
  'ring',
  'text',
]);

const IGNORED_CSS_VARS = new Set([
  '--font-plex-mono',
  '--font-urbanist',
]);

function walkFiles(dir, predicate, files = []) {
  const absoluteDir = path.join(ROOT, dir);

  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = path.join(absoluteDir, entry);
    const relativePath = path.relative(ROOT, absolutePath);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      walkFiles(relativePath, predicate, files);
      continue;
    }

    if (predicate(relativePath)) {
      files.push(relativePath);
    }
  }

  return files;
}

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function getCommonPrefix(slugs) {
  if (slugs.length < 2) {
    return null;
  }

  const parts = slugs.map((slug) => slug.split('-'));
  const prefix = [];
  const shortest = Math.min(...parts.map((item) => item.length));

  for (let index = 0; index < shortest; index += 1) {
    const value = parts[0][index];
    if (parts.every((item) => item[index] === value)) {
      prefix.push(value);
    } else {
      break;
    }
  }

  return prefix.length >= 2 ? prefix.join('-') : null;
}

function collectThemeData(cssFiles) {
  const colorTokens = new Set();
  const shadowTokens = new Set();
  const cssVars = new Set();
  const customStems = new Set();
  const varReferences = [];

  for (const file of cssFiles) {
    const content = read(file);
    const localSlugs = [];

    for (const match of content.matchAll(/--(color|shadow)-([a-z0-9-]+)\s*:/g)) {
      const [, kind, slug] = match;
      cssVars.add(`--${kind}-${slug}`);

      if (kind === 'color') {
        colorTokens.add(slug);
      } else {
        shadowTokens.add(slug);
      }

      if (!file.startsWith('src/styles/config/')) {
        localSlugs.push(slug);
      }
    }

    for (const match of content.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
      cssVars.add(match[1]);
    }

    for (const match of content.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
      varReferences.push({ file, variable: match[1] });
    }

    const commonPrefix = getCommonPrefix([...new Set(localSlugs)]);
    if (commonPrefix) {
      customStems.add(commonPrefix);
    }
  }

  return {
    colorTokens,
    cssVars,
    customStems,
    shadowTokens,
    varReferences,
  };
}

function normalizeClassToken(rawToken) {
  const withoutVariant = rawToken.split(':').at(-1);
  return withoutVariant?.replace(/\\\//g, '/').split('/')[0] ?? '';
}

function parseUtility(token) {
  const normalized = normalizeClassToken(token);
  const match = normalized.match(/^([a-z]+)-(.+)$/);

  if (!match) {
    return null;
  }

  const [, utility, slug] = match;

  if (COLOR_UTILITIES.has(utility)) {
    return { kind: 'color', slug, utility };
  }

  if (utility === 'shadow') {
    return { kind: 'shadow', slug, utility };
  }

  return null;
}

function collectClassCandidates(files) {
  const candidates = [];
  const tokenPattern = /(?:^|[\s'"`])((?:[a-z0-9-]+:)*(?:accent|bg|border|caret|decoration|divide|outline|placeholder|ring|shadow|text)-[a-z][a-z0-9-]*(?:-[a-z0-9-]+)*(?:\/[0-9]+)?)(?=[\s'"`])/g;

  for (const file of files) {
    const content = read(file);

    for (const match of content.matchAll(tokenPattern)) {
      const parsed = parseUtility(match[1]);
      if (parsed) {
        candidates.push({ ...parsed, className: match[1], file });
      }
    }
  }

  return candidates;
}

function shouldCheckCandidate(candidate, stems) {
  return [...stems].some((stem) => (
    candidate.slug === stem || candidate.slug.startsWith(`${stem}-`)
  ));
}

function main() {
  const cssFiles = CSS_ROOTS.flatMap((root) => walkFiles(root, (file) => path.extname(file) === '.css'));
  const classFiles = CLASS_ROOTS.flatMap((root) => walkFiles(root, (file) => FILE_EXTENSIONS.has(path.extname(file))));
  const { colorTokens, cssVars, customStems, shadowTokens, varReferences } = collectThemeData(cssFiles);
  const classCandidates = collectClassCandidates(classFiles);
  const failures = [];

  for (const { file, variable } of varReferences) {
    if (!cssVars.has(variable) && !IGNORED_CSS_VARS.has(variable)) {
      failures.push(`${file}: references missing CSS variable ${variable}`);
    }
  }

  for (const candidate of classCandidates) {
    if (!shouldCheckCandidate(candidate, customStems)) {
      continue;
    }

    const tokens = candidate.kind === 'color' ? colorTokens : shadowTokens;
    if (!tokens.has(candidate.slug)) {
      failures.push(
        `${candidate.file}: ${candidate.className} has no --${candidate.kind}-${candidate.slug} token`
      );
    }
  }

  if (failures.length > 0) {
    console.error('Theme token check failed:');
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Theme token check passed for ${cssFiles.length} CSS files and ${classFiles.length} source files.`);
}

main();
