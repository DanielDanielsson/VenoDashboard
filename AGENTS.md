# VenoDashboard Agent Guide

## What This Repo Is

`VenoDashboard` is the active Next.js frontend for the Veno platform.

It is the public and admin facing dashboard that reads data from `VenoAPI` and renders:

1. overview metrics
2. glucose timeline and AGP
3. connections and freshness state
4. settings, timers, and API keys for signed in admin users
5. the public about page

Do not treat this repo as the source of truth for glucose ingestion or storage. That belongs to `VenoAPI`.

## Core Architecture

1. `src/app` contains the app router pages and route handlers.
2. `ui/components` contains small reusable UI pieces.
3. `ui/compositions` contains higher level dashboard sections and page level compositions.
4. `src/lib` contains auth, API clients, data shaping, caching, and server side helpers.
5. `src/styles/config` is the canonical home for theme and font utilities.
6. `.claude/skills` contains repo-local skills that apply only to `VenoDashboard`

## Local Agent Context

This repo is intended to be usable on its own.

Repo-specific guidance should live here:

1. `AGENTS.md` for always-on repo rules
2. `.claude/skills` for focused local workflows like theming

Do not assume the parent `PulseGlucose` workspace structure is available when writing repo-local guidance for `VenoDashboard`.

## Routing And Auth

Middleware currently allows public access only to:

1. `/dashboard`
2. `/dashboard/statistics`
3. `/dashboard/about`
4. `/login`
5. `/api/dashboard/*`
6. static assets and framework routes

Everything else under `/dashboard` is protected and requires admin sign in.

Relevant files:

1. `middleware.ts`
2. `src/lib/auth.ts`

Important auth details:

1. `OWNER_LOGIN_USERNAME` defaults to `admin` if omitted.
2. `OWNER_LOGIN_PASSWORD` must be configured or sign in is effectively disabled.
3. The owner session cookie is hashed from the password, not stored as the raw password.

## Data Flow

The browser should not talk to `VenoAPI` directly for privileged reads.

The normal pattern is:

1. page or composition calls local `/api/dashboard/*` route
2. route reads from `src/lib`
3. server side helper talks to `VenoAPI`
4. response is shaped for the dashboard UI

Key files:

1. `src/lib/pulse-api/client.ts`
2. `src/lib/pulse-api/glucose.ts`
3. `src/lib/glucose/dashboard-data.ts`

Important current behavior:

1. glucose history is a merged official plus Share timeline
2. Tandem history is chunked across the full requested range to avoid truncation
3. Apple HealthKit steps come through the admin health steps path in `VenoAPI`
4. connections freshness is derived from actual recent data, not only static status fields

## Charts

Main chart files:

1. `ui/components/GlucoseChart/GlucoseChart.tsx`
2. `ui/components/GlucoseAgpChart/GlucoseAgpChart.tsx`
3. `ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView.tsx`

Important chart rules:

1. the default statistics range is currently `3 days`
2. AGP is intentionally disabled when the selected filter does not cover more than 24 hours
3. AGP height is intentionally fixed at `400px`
4. glucose timeline height must be based on the bands that actually exist, not stale reserved space
5. chart axis fonts should use utilities from `font-styles.css`, not inline font styles

## Styling Rules

This repo uses centralized font utilities and component theme variables.

### Fonts

All font sizing, weight, spacing, and family choices should come from:

1. `src/styles/config/font-styles.css`

Do not introduce ad hoc Tailwind font size or weight classes when a shared font utility should exist.

If a font role is missing:

1. add a new utility in `font-styles.css`
2. reuse it from the component

### Component Theme Variables

The preferred component theming pattern is the `DashboardPanel` pattern:

1. component owns a local `*.css` file
2. that file defines theme vars under `@layer theme`
3. vars are exposed through `@theme inline`
4. the TSX uses named Tailwind classes, not arbitrary CSS variable utility syntax
5. if a component can inherit the page theme through CSS variables, do that by default
6. explicit `theme` props are overrides only, not something to pass routinely

Examples:

1. `ui/components/DashboardPanel/dashboardPanel.css`
2. `ui/components/SecondaryButton/secondaryButton.css`
3. `ui/components/NumberInput/numberInput.css`

Avoid arbitrary Tailwind var utilities for component theme colors.

Examples to avoid:

1. arbitrary border color utilities
2. arbitrary background color utilities
3. arbitrary text color utilities

Use named classes from the component theme file instead.

### Design Tokens And Color Ownership

All raw color values belong in:

1. `src/styles/config/colors.css`

Rules:

1. `colors.css` should only contain shared design tokens, never component specific token names
2. all shared color tokens must start with `--color-base-`
3. the same raw color should not be duplicated across multiple token names
4. if two components need the same color, they should both map from the same base token
5. component CSS files should map local component vars from base tokens in `colors.css`
6. component CSS files may define component scoped vars like `--color-dashboard-panel-bg`, but those should be mappings, not raw literals
7. shadow tokens that participate in the design system should follow the same pattern and live in `colors.css`

Example pattern:

1. `colors.css` defines a base token such as `--color-base-surface-panel-light`
2. `dashboardPanel.css` maps `--color-dashboard-panel-bg` from that base token
3. TSX uses `bg-dashboard-panel-bg`

Do not put raw color literals in component theme files when a base token can own that value.

### Reuse Before Reinventing

When building interactive UI pieces:

1. prefer reusing existing base or shared components before making a new visual shell
2. if a floating panel can reuse `DashboardPanel`, prefer that over creating a parallel panel system
3. if a trigger can reuse `ui/base/Button`, use it instead of rendering a raw `<button>`
4. only create a new component specific theme file when existing component structure cannot be reused cleanly

### Theme Inheritance

Theme should normally flow from the page or document root through CSS variable inheritance.

Rules:

1. components should inherit the active theme automatically whenever possible
2. avoid call site logic like `theme={isDark ? 'dark' : 'light'}` unless you are intentionally overriding inherited theme
3. keep `theme` props available only as explicit opt in overrides
4. if inheritance already solves the problem, do not branch on light and dark in TSX

### Generated CSS Imports

Component CSS is imported through:

1. `src/styles/_component-imports.css`

This file is generated. Do not hand edit it.

If you add or remove a component CSS file, run:

1. `npm run gen:css`

The repo already runs this in `predev` and `prebuild`.

## Images

The About page uses Bunny CDN image optimization through:

1. `ui/base/BunnyImage/BunnyImage.tsx`
2. `src/utils/getBunnyImage.ts`

If a new page needs remote optimized imagery, prefer `BunnyImage` over raw `<img>`.

## Environment

Important env vars:

1. `PULSE_API_BASE_URL`
2. `PULSE_API_ADMIN_TOKEN`
3. `PULSE_API_CONSUMER_KEY`
4. `PULSE_API_STATUS_TOKEN`
5. `DEXCOM_GATEWAY_BASE_URL`
6. `DEXCOM_GATEWAY_ADMIN_TOKEN`
7. `OWNER_LOGIN_USERNAME`
8. `OWNER_LOGIN_PASSWORD`
9. `NEXT_PUBLIC_SITE_URL`

Reference file:

1. `.env.example`

Important deployment detail:

1. inside the deployed Docker stack, the dashboard should usually talk to `VenoAPI` on the internal service URL, not the public API domain

## Local Development

Default scripts:

1. `npm run dev` starts Next on port `3001`
2. `npm run build` refreshes contract snapshots before building
3. `npm run test:e2e` runs Playwright

Contract scripts:

1. `contracts:validate`
2. `scripts/refresh-contract-snapshots.mjs`
3. `scripts/validate-contracts.mjs`

These read from `PULSE_API_BASE_URL`. If that env var is wrong, CI style validation will fail or validate the wrong backend.

## Testing And Pre Push

Mirror CI before pushing.

Run at minimum:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `PULSE_API_BASE_URL=https://api.venoplatform.com npm run contracts:validate`
5. `npm run test:links`
6. `PULSE_API_BASE_URL=https://api.venoplatform.com npm run build`

Also run when practical:

1. `npm run test:e2e`

If Playwright is blocked locally by an already running dev server, call that out explicitly before pushing.

## Known Generated Noise

These files often change during local build and contract refresh work:

1. `content/contracts/agent-context.snapshot.json`
2. `content/contracts/openapi.snapshot.json`

Do not commit them casually. Only commit them when you intentionally mean to refresh the stored contract snapshots.

Transient local tool output should stay out of the repo. The `.playwright-mcp` folder is ignored and disposable.
