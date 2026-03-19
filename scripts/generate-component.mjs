import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const UI_DIR = join(ROOT, 'ui');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = {};

for (const arg of args) {
  const match = arg.match(/^--(\w+)=(.+)$/);
  if (match) flags[match[1]] = match[2];
}

const name = flags.name;
const layer = flags.layer; // base | component | composition
const base = flags.base; // only for component/composition layer

const VALID_LAYERS = ['base', 'component', 'composition'];

if (!name || !layer) {
  console.error('Usage: node scripts/generate-component.mjs --layer=<base|component|composition> --name=<ComponentName> [--base=<BaseComponent>]');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/generate-component.mjs --layer=base --name=Checkbox');
  console.error('  node scripts/generate-component.mjs --layer=component --name=PrimaryCheckbox --base=Checkbox');
  console.error('  node scripts/generate-component.mjs --layer=composition --name=FormField');
  process.exit(1);
}

if (!VALID_LAYERS.includes(layer)) {
  console.error(`Invalid layer "${layer}". Must be one of: ${VALID_LAYERS.join(', ')}`);
  process.exit(1);
}

if ((layer === 'component' || layer === 'composition') && !base) {
  console.error(`--base is required for layer "${layer}". Specify which base component to wrap.`);
  process.exit(1);
}

if (!/^[A-Z][a-zA-Z0-9]+$/.test(name)) {
  console.error(`Component name "${name}" must be PascalCase (e.g. PrimaryButton).`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const layerDir = layer === 'composition' ? 'compositions' : `${layer}s`;
const camelName = name[0].toLowerCase() + name.slice(1);
const outDir = join(UI_DIR, layerDir === 'bases' ? 'base' : layerDir, name);

if (existsSync(outDir)) {
  console.error(`Directory already exists: ${outDir}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

function write(filename, content) {
  const filepath = join(outDir, filename);
  writeFileSync(filepath, content);
  console.log(`  created ${filepath.replace(ROOT + '/', '')}`);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function generateBase() {
  // types file
  write(`${name}.types.ts`, `import type { ButtonHTMLAttributes } from 'react';
import { Stylable } from '../../types';

export type ${name}Props = Stylable &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    ariaLabel?: string;
  };
`);

  // component file
  write(`${name}.tsx`, `import type { ReactElement, Ref } from 'react';
import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';
import type { ${name}Props } from './${name}.types';

export const ${name} = forwardRef<HTMLButtonElement, ${name}Props>(
  (
    { ariaLabel, children, twStyles, className, ...rest }: ${name}Props,
    ref: Ref<HTMLButtonElement>,
  ): ReactElement | null => (
    <button
      aria-label={ariaLabel}
      className={twMerge(
        'm-0 p-0',
        'appearance-none',
        rest.disabled ? 'cursor-not-allowed opacity-50' : 'bg-transparent text-current',
        className,
        twStyles,
      )}
      ref={ref}
      type="button"
      {...rest}
    >
      {children}
    </button>
  ),
);

${name}.displayName = '${name}';
`);

  // barrel export
  write('index.ts', `export { ${name} } from './${name}';
export type { ${name}Props } from './${name}.types';
`);
}

function generateComponent() {
  const tokenPrefix = camelName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

  // CSS file
  write(`${camelName}.css`, `@custom-variant theme-${tokenPrefix}-light (.theme-${tokenPrefix}-light);
@custom-variant theme-${tokenPrefix}-dark (.theme-${tokenPrefix}-dark);

@layer theme {
  :root {
    --color-${tokenPrefix}-bg: var(--color-base-black);
    --color-${tokenPrefix}-bg-hover: var(--color-base-dark-grey);
    --color-${tokenPrefix}-bg-disabled: var(--color-base-light-grey);

    --color-${tokenPrefix}-text: var(--color-base-white);
    --color-${tokenPrefix}-text-disabled: var(--color-opacity-dark-50);

    --color-${tokenPrefix}-outline: var(--color-base-black);
  }

  .theme-dark {
    --color-${tokenPrefix}-bg: var(--color-base-white);
    --color-${tokenPrefix}-bg-hover: var(--color-base-light-grey);
    --color-${tokenPrefix}-bg-disabled: var(--color-base-light-grey);

    --color-${tokenPrefix}-text: var(--color-base-black);
    --color-${tokenPrefix}-text-disabled: var(--color-opacity-dark-50);

    --color-${tokenPrefix}-outline: var(--color-base-white);
  }

  .theme-${tokenPrefix}-light {
    --color-${tokenPrefix}-bg: var(--color-base-white);
    --color-${tokenPrefix}-bg-hover: var(--color-base-light-grey);
    --color-${tokenPrefix}-bg-disabled: var(--color-base-light-grey);

    --color-${tokenPrefix}-text: var(--color-base-black);
    --color-${tokenPrefix}-text-disabled: var(--color-opacity-dark-50);

    --color-${tokenPrefix}-outline: var(--color-base-white);
  }

  .theme-${tokenPrefix}-dark {
    --color-${tokenPrefix}-bg: var(--color-base-black);
    --color-${tokenPrefix}-bg-hover: var(--color-base-dark-grey);
    --color-${tokenPrefix}-bg-disabled: var(--color-base-dark-grey);

    --color-${tokenPrefix}-text: var(--color-base-white);
    --color-${tokenPrefix}-text-disabled: var(--color-opacity-dark-50);

    --color-${tokenPrefix}-outline: var(--color-base-black);
  }
}

@theme inline {
  --color-${tokenPrefix}-bg: var(--color-${tokenPrefix}-bg);
  --color-${tokenPrefix}-bg-hover: var(--color-${tokenPrefix}-bg-hover);
  --color-${tokenPrefix}-bg-disabled: var(--color-${tokenPrefix}-bg-disabled);
  --color-${tokenPrefix}-text: var(--color-${tokenPrefix}-text);
  --color-${tokenPrefix}-text-disabled: var(--color-${tokenPrefix}-text-disabled);
  --color-${tokenPrefix}-outline: var(--color-${tokenPrefix}-outline);
}
`);

  // component file
  write(`${name}.tsx`, `import type { ReactElement, Ref } from 'react';
import { forwardRef } from 'react';
import { ${base} } from '../../base/${base}/${base}';
import type { ${base}Props } from '../../base/${base}/${base}.types';
import type { Themable } from '../../types/themable';

type ${name}Theme = 'light' | 'dark';
type ${name}Props = ${base}Props & Themable<${name}Theme>;

export const ${name} = forwardRef<HTMLButtonElement, ${name}Props>(
  ({ theme, ...props }: ${name}Props, ref: Ref<HTMLButtonElement>): ReactElement | null => (
    <${base}
      {...props}
      ref={ref}
      twStyles={[
        theme === 'light' ? 'theme-${tokenPrefix}-light' : theme === 'dark' ? 'theme-${tokenPrefix}-dark' : null,
        'bg-${tokenPrefix}-bg text-${tokenPrefix}-text',
        'px-4 py-2 rounded-md',
        'font-medium text-sm',
        'hover:bg-${tokenPrefix}-bg-hover',
        'disabled:bg-${tokenPrefix}-bg-disabled disabled:text-${tokenPrefix}-text-disabled',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-${tokenPrefix}-outline',
        props.twStyles,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  ),
);

${name}.displayName = '${name}';
`);

  // barrel export
  write('index.ts', `export { ${name} } from './${name}';
`);
}

function generateComposition() {
  const tokenPrefix = camelName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

  // CSS file (minimal starter)
  write(`${camelName}.css`, `@layer theme {
  :root {
    --color-${tokenPrefix}-bg: var(--color-base-white);
    --color-${tokenPrefix}-text: var(--color-base-black);
  }

  .theme-dark {
    --color-${tokenPrefix}-bg: var(--color-base-black);
    --color-${tokenPrefix}-text: var(--color-base-white);
  }
}

@theme inline {
  --color-${tokenPrefix}-bg: var(--color-${tokenPrefix}-bg);
  --color-${tokenPrefix}-text: var(--color-${tokenPrefix}-text);
}
`);

  // component file
  write(`${name}.tsx`, `import type { ReactElement, Ref } from 'react';
import { forwardRef } from 'react';
import { ${base} } from '../../base/${base}/${base}';
import type { Stylable } from '../../types/stylable';

type ${name}Props = Stylable & {
  children?: React.ReactNode;
};

export const ${name} = forwardRef<HTMLDivElement, ${name}Props>(
  ({ children, twStyles, ...rest }: ${name}Props, ref: Ref<HTMLDivElement>): ReactElement | null => (
    <div ref={ref} {...rest}>
      {children}
    </div>
  ),
);

${name}.displayName = '${name}';
`);

  // barrel export
  write('index.ts', `export { ${name} } from './${name}';
`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log(`\nScaffolding ${layer}: ${name}`);

if (layer === 'base') generateBase();
else if (layer === 'component') generateComponent();
else generateComposition();

console.log(`\nDone! Next steps:`);
console.log(`  1. Update the generated types and element types to match your component`);
if (layer !== 'base') {
  console.log(`  2. Run "npm run gen:css" to register the CSS imports`);
  console.log(`  3. Customize the CSS tokens in ${camelName}.css`);
}
console.log('');
