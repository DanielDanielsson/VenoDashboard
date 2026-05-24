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
6. `.agents/skills` contains repo-local skills that apply only to `VenoDashboard`

## Composition And Component File Structure

When a composition or component file starts accumulating unrelated module level concerns, split those concerns into nearby sibling files before adding more bulk to the main component file.

Preferred folder pattern:

1. `types.ts` owns exported types, interfaces, and prop shapes
2. `const.ts` owns module level constants and static data
3. `utils.ts` owns pure helpers and browser storage subscription helpers

Keep the main composition file focused on rendering, hooks, and component flow.

## Local Agent Context

This repo is intended to be usable on its own.

Repo-specific guidance should live here:

1. `AGENTS.md` for always-on repo rules
2. `.agents/skills` for focused local workflows like theming

Do not assume the parent `PulseGlucose` workspace structure is available when writing repo-local guidance for `VenoDashboard`.

## Notifications

The app now has a shared notification foundation for toast style feedback.

Core rules:

1. the notification provider is mounted at the app root so client components can trigger notifications from anywhere
2. use the shared notification hook instead of inventing one off toast systems
3. preferred public helpers are `notify`, `notifySuccess`, `notifyWarning`, and `notifyError`
4. treat the shared notification API as the default path for cross page feedback that should float above current content
5. do not build feature specific toast containers inside pages, panels, drawers, or dialogs
6. when adding a feature specific notification pattern, prefer a small domain helper that delegates to the shared notification API
7. if a feature still keeps inline status text for local context, that does not justify bypassing the shared notification path for the global feedback event

Timer specific rules:

1. dashboard timer stream ownership lives in `ui/compositions/DashboardTimersBridge`
2. `SharedTimersPanel` should react to shared browser timer events, not open its own `EventSource`
3. timer started and timer finished notifications should flow through the shared notifications API from the global timer bridge
4. if timer stream payload handling changes, update the bridge event contract before changing panel level behavior

## Dashboard Panels

Dashboard pages are now data driven.

Do not add new dashboard panels by hardcoding page level grid JSX.

Use the dashboard JSON, registry, and renderer structure that already exists.

Core files:

1. `src/lib/dashboard/schema.ts`
2. `src/lib/dashboard/registry.ts`
3. `src/lib/dashboard/definitions/overview.json`
4. `src/lib/dashboard/definitions/statistics.json`
5. `src/lib/dashboard/panel-registry.ts`
6. `src/lib/dashboard/url-state.ts`
7. `src/lib/dashboard/view-panel.ts`
8. `ui/compositions/DashboardDefinitionRenderer/DashboardDefinitionRenderer.tsx`
9. `ui/compositions/DashboardGrid/DashboardGrid.tsx`
10. `ui/compositions/DashboardGrid/DashboardGridPanel.tsx`
11. `ui/compositions/DashboardUrlStateBridge/DashboardUrlStateBridge.tsx`
12. `ui/compositions/DashboardViewPanelUrlStateBridge/DashboardViewPanelUrlStateBridge.tsx`
13. `src/lib/dashboard/settings.ts`

Important structure rules:

1. a dashboard definition is the source of truth for panel membership and layout
2. every dashboard panel must exist as an element in dashboard JSON
3. layout belongs in `spec.layout`
4. content identity belongs in `spec.elements`
5. a panel renderer is selected through `panel.spec.vizConfig.group`
6. group to component mapping belongs in a panel registry, not in the page component
7. dashboard pages should render through `DashboardDefinitionRenderer`, not custom grid markup
8. only dashboard grid panels should use `DashboardGridPanel`
9. popovers, dialogs, and other floating layers must stay separate from dashboard grid panel structure

Current dashboard split:

1. overview uses `ui/compositions/DashboardDefinitionRenderer/overviewPanelRegistry.tsx`
2. statistics builds its registry inside `ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView.tsx`
3. overview page chrome is centralized in `ui/compositions/OverviewDashboardView/OverviewDashboardView.tsx`

Current statistics panels include:

1. average glucose
2. time in range
3. workout types
4. glucose timeline
5. AGP

When adding a new panel:

1. create or update the composition that renders the actual panel content
2. register a stable `vizConfig.group` string for it
3. add the panel element to the dashboard JSON definition
4. add the layout item to the dashboard JSON definition
5. register the renderer in the correct dashboard panel registry
6. if the panel has editable settings, define a typed settings shape and add a settings registration through `DashboardPanelSettingsRegistry`
7. keep persisted settings in `vizConfig.spec.options`
8. make sure the panel still works with built in defaults when persisted settings are missing or the settings backend is unavailable

Settings rules:

1. panel settings are edited in the shared right side settings drawer owned by `DashboardGrid`
2. panel settings UI belongs in settings registrations, not inside the panel chrome itself
3. default settings should be merged with persisted settings so partial saved state does not break the panel
4. public visitors may preview settings locally
5. only admin saves persist through the dashboard settings path

Naming rules:

1. use stable panel ids like `panel-time-in-range`
2. use stable group names like `veno.time-in-range`
3. avoid renaming ids or groups casually because saved dashboard settings depend on them

Panel view and URL state rules:

1. statistics time range URL parsing and serialization live in `src/lib/dashboard/url-state.ts`
2. statistics supports `from`, `to`, and `timezone` URL parameters
3. unsupported or invalid dashboard URL parameters should be normalized and reported through `useDashboardNotifications`
4. overview rejects unsupported time range parameters through `DashboardUrlStateBridge`
5. focused panel view is controlled by `viewPanel` through `DashboardViewPanelUrlStateBridge`
6. focused panel edit is controlled by `editPanel` through `DashboardViewPanelUrlStateBridge`
7. `viewPanel` and `editPanel` values should use stable panel keys like `panel-time-in-range`
8. `editPanel` takes precedence over `viewPanel` when both are present, and URL normalization should remove the inactive parameter
9. legacy numeric panel ids are aliases only and should normalize to stable panel keys
10. changing time range must preserve any active `viewPanel` or `editPanel` parameter
11. selecting a new time range should update the URL first, then let URL driven state update the dashboard data
12. do not add separate page level focused panel state when `DashboardGrid` and `DashboardViewPanelUrlStateBridge` can own it
13. `DashboardDefinitionRenderer` and `DashboardGridRuntime` must pass both viewed and edited panel state through to `DashboardGrid`

Panel interaction rules:

1. panel action buttons are always mounted but hidden until panel hover or menu open
2. the three dot menu opens without requiring dashboard edit mode
3. clicking outside an open panel menu should close it
4. selecting `Edit` from a panel menu must enter focused panel edit mode, update `editPanel`, and open the shared settings drawer
5. selecting `View` from a panel menu must enter solo panel view and update `viewPanel`
6. focused panel edit mode also enters focused panel view so the edited panel uses the available dashboard area
7. hovering a panel and pressing `V` enters view mode for that panel
8. pressing `V` while already viewing that same panel exits focused panel view
9. pressing `V` while editing a panel switches that panel from `editPanel` to `viewPanel`
10. hovering a panel and pressing `E` enters focused panel edit mode for that panel
11. pressing `E` while already editing that same panel exits focused panel edit mode
12. pressing `E` while viewing a panel switches that panel from `viewPanel` to `editPanel`
13. keyboard shortcuts must be ignored inside inputs, textareas, selects, and editable content
14. focused panel view and edit should keep the selected panel when time range changes
15. focused panel modes should render only the `to dashboard` back action in the dashboard header toolbar, not dashboard level edit, save, close, add, or delete controls
16. panel settings save and close controls belong in the right side settings drawer
17. focused panel view should avoid page scroll by sizing the grid panel to the remaining viewport height
18. grid move animations should only run while editing layout, not while entering or leaving focused panel view or edit mode
19. panel menus should use the same visual language as `DashboardTimeRangePicker`
20. keyboard shortcut hints should use `ui/components/KeyboardKey/KeyboardKey.tsx`
21. view and edit mode transitions should avoid visible remount flashes. Cache or preserve panel display state when a panel fetches data on mount

## Multiple Dashboards

The app now supports user created dashboards, pinned dashboards, and a configurable home dashboard.

Canonical routes and files:

1. `/dashboards` is the dashboard library page.
2. `/dashboards/[dashboardUid]` is the canonical route for viewing a dashboard.
3. `/dashboards/overview` is the built in live overview dashboard.
4. `/dashboards/statistics` is the built in time range statistics dashboard.
5. `/dashboard` and `/dashboard/statistics` are compatibility paths only. Do not add new dashboard behavior there.
6. `src/app/dashboards/layout.tsx` and `src/app/dashboard/layout.tsx` both load `loadDashboardLibrary()` and pass pinned dashboards into `SideBarNavigation`.
7. `ui/compositions/SideBarNavigation/SideBarNavigation.tsx` owns the left navigation dashboards accordion.
8. `ui/compositions/DashboardLibrary/DashboardLibrary.tsx` owns dashboard create, pin, unpin, and library delete actions.
9. `src/lib/dashboard/library.ts` merges the dashboard list with dashboard preferences.
10. `src/lib/dashboard/preferences.ts` loads home and pinned dashboard preferences.
11. `src/lib/dashboard/resources.ts` loads a dashboard resource and prefers persisted dashboard settings when they exist.
12. `src/lib/dashboard/panel-catalog.ts` is the source of truth for add panel options, default panel definitions, default layout, and dashboard type compatibility.

Dashboard type rules:

1. dashboard type is immutable after creation
2. supported types are `live` and `timeRange`
3. live dashboards may only contain live panels
4. time range dashboards may only contain time range panels
5. compatibility checks belong in the panel catalog and API validation, not in ad hoc UI filters
6. in V1, do not allow a mixed dashboard or cross type panel escape hatch

Rendering rules:

1. live dashboards must render through `OverviewDashboardView` and `DashboardDefinitionRenderer`, even when empty
2. never special case an empty live dashboard with a standalone empty card, because that bypasses the shared edit toolbar and Add panel drawer
3. time range dashboards render through `GlucoseAnalysisView`
4. `DashboardGrid` owns dashboard edit mode, Add panel, Save, Close, layout editing, delete in edit mode, and the right side Add panel drawer
5. dynamic dashboard pages should not duplicate page level Edit dashboard or Delete dashboard buttons through `DashboardTitleEditor`
6. the live dashboard internal edit toolbar should align left, matching the time range toolbar placement
7. time range dashboards use `editControlsPortalId` to place shared grid controls next to the time range selector
8. delete dashboard should only appear from shared grid edit mode when deletion is allowed

Pinned and home dashboard rules:

1. public visitors can view dashboards and pinned navigation links
2. only admins can create, delete, pin, unpin, or set home dashboards
3. after a successful pin, unpin, or home preference save, call `router.refresh()` so server layouts reload the left navigation
4. the home dashboard must not be deletable
5. do not show inline explanatory text such as `Home dashboard cannot be deleted`; use disabled controls and notification feedback for mutation outcomes
6. pinned dashboards should appear under the Dashboards accordion in the left navigation

Mutation feedback rules:

1. dashboard create, rename, delete, pin, unpin, save, and validation failures should use shared notifications
2. do not render inline API error messages beside toolbar buttons or inside the library list when a notification already reports the event
3. successful dashboard settings saves should update local persisted state before clearing runtime draft state
4. dashboard settings saves should use the current persisted dashboard settings version when available, and `null` when the settings row does not exist yet

Reusable UI rules learned from dashboard management:

1. do not use native styled selects for reusable dashboard controls
2. use `ui/components/DropdownMenu` for menu style selects that should match the time range picker visual language
3. dashboard toolbar buttons should use the shared dashboard time picker token classes used by `DashboardGrid`
4. add panel options should always open in the right side overlay owned by `DashboardGrid`

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
3. `ui/components/PieChart/PieChart.tsx`
4. `ui/components/LineChart/LineChart.tsx`
5. `ui/components/HistogramChart/HistogramChart.tsx`
6. `ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView.tsx`

Important chart rules:

1. the default statistics range is currently `3 days`
2. AGP is intentionally disabled when the selected filter does not cover more than 24 hours
3. AGP height is intentionally fixed at `400px`
4. glucose timeline height must be based on the bands that actually exist, not stale reserved space
5. chart axis fonts should use utilities from `font-styles.css`, not inline font styles
6. generic pie, line, and histogram visualizations belong in reusable `ui/components` chart components
7. panel specific data shaping should stay beside the panel composition, such as `timeInRangeChart.ts` or `workoutTypeChart.ts`
8. prefer reusing generic chart components before creating panel specific SVG implementations

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
2. `ADMIN_BEARER_TOKEN`
3. `DEXCOM_GATEWAY_BASE_URL`
4. `OWNER_LOGIN_USERNAME`
5. `OWNER_LOGIN_PASSWORD`
6. `NEXT_PUBLIC_SITE_URL`

Optional env vars:

1. `PULSE_API_CONSUMER_KEY`
2. `PULSE_API_STATUS_TOKEN`
3. `DEXCOM_GATEWAY_ADMIN_TOKEN`

Reference file:

1. `.env.example`

Important deployment detail:

1. inside the deployed Docker stack, the dashboard should usually talk to `VenoAPI` on the internal service URL, not the public API domain
2. `VenoDashboard` does not use `PULSE_API_TARGET`
3. `VenoDashboard` does not use `PULSE_API_ADMIN_TOKEN`
4. if `PULSE_API_CONSUMER_KEY` is unset, consumer requests fall back to `ADMIN_BEARER_TOKEN`
5. if `DEXCOM_GATEWAY_ADMIN_TOKEN` is unset, Dexcom gateway requests fall back to `ADMIN_BEARER_TOKEN`
6. if local works for `/api/dashboard/status` but glucose history or timers fail with `403`, suspect a stale `ADMIN_BEARER_TOKEN` first
7. recommended `.env.local` workflow: keep prod values first, then add a local override block with the same keys at the end
8. in `.env.local`, the last duplicate key wins, so commenting out the local override block switches the dashboard back to prod

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

When debugging locally, treat local API targets as a first check, not a later guess.

Rules:

1. if `PULSE_API_BASE_URL` points to `localhost` or `127.0.0.1`, verify that the target port is actually listening before debugging dashboard code
2. verify that `GET /api/status?format=json` responds from that local API target before assuming the dashboard has a frontend bug
3. if the local API depends on Docker services, check that Docker is running before investigating dashboard rendering or data flow
4. if the local API is down, say so explicitly and treat missing dashboard data as an environment problem first

## Testing And Pre Push

Mirror CI before pushing.

Preferred:

1. run `npm run ci:local`

This is the one-command local equivalent of the current GitHub Actions workflow.

For this repo, a user request to commit changes should be treated as requiring local CI verification before the commit is reported as ready.

Rules:

1. before closing out a commit request, run `npm run ci:local`
2. if `npm run ci:local` fails, say so explicitly and do not imply the work is push-ready
3. if `npm run ci:local` is blocked by an external issue, say exactly what blocked it
4. do not treat "commit" as complete in this repo until the local CI mirror has been checked

If you need to run checks individually, use:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `PULSE_API_BASE_URL=https://api.venoplatform.com npm run contracts:validate`
5. `npm run test:links`
6. `PULSE_API_BASE_URL=https://api.venoplatform.com npm run build`
7. `npm run test:e2e`

## Component Testing Rules

Component tests are a requirement, not a nice to have.

Rules:

1. every folder in `ui/base` and `ui/components` should have a colocated `ComponentName.spec.tsx` or `ComponentName.spec.ts` file when the component is active
2. tests should verify behavior, state, side effects, emitted events, or meaningful rendering contracts
3. do not add low-value snapshot tests or layout-only tests just to increase count
4. if a component is only a tiny pass-through primitive, test the contract that actually matters
5. if a component introduces logic, interactivity, async work, theme switching, routing, timers, storage, or external events, it should have a focused unit test
6. composition tests are useful when page-level logic exists, but the base and component layers come first

Current test discovery includes:

1. `tests/**/*.test.ts`
2. `ui/**/*.spec.ts`
3. `ui/**/*.spec.tsx`

So running `npm run test` already covers the colocated component specs.
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
