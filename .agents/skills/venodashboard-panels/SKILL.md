---
name: venodashboard-panels
description: Create or refactor VenoDashboard dashboard panels using the JSON dashboard schema, panel registries, shared grid chrome, and settings drawer structure
---

# VenoDashboard Panels

Use this when adding, refactoring, or wiring dashboard panels in `VenoDashboard`.

This skill exists to keep panel work aligned with the data driven dashboard architecture.

## Overview

In this repo, a dashboard panel is not just a React component.

It is the combination of:

1. a dashboard JSON element
2. a dashboard JSON layout item
3. a `vizConfig.group`
4. a panel registry entry
5. an optional settings registration
6. a rendered composition or component

If one of those parts is skipped, the panel structure starts to drift.

## Read First

Before changing panel structure, read:

1. `AGENTS.md`
2. `src/lib/dashboard/schema.ts`
3. `src/lib/dashboard/registry.ts`
4. `src/lib/dashboard/settings.ts`
5. `ui/compositions/DashboardDefinitionRenderer/DashboardDefinitionRenderer.tsx`
6. `ui/compositions/DashboardGrid/DashboardGrid.tsx`
7. `ui/compositions/DashboardGrid/DashboardGridPanel.tsx`

Then read the concrete dashboard you are modifying:

1. `src/lib/dashboard/definitions/overview.json`
2. `src/lib/dashboard/definitions/statistics.json`

Then read the relevant registry:

1. `ui/compositions/DashboardDefinitionRenderer/overviewPanelRegistry.tsx`
2. `ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView.tsx`

## Golden Path For A New Panel

Follow this order.

1. Decide which dashboard owns the panel.
2. Create the rendering composition under `ui/compositions/<PanelName>/`.
3. Reuse `ui/components/DashboardPanel/DashboardPanel.tsx` for the panel shell unless there is a real reason not to.
4. Add a stable `vizConfig.group` string.
5. Add a new panel element in the dashboard JSON `spec.elements`.
6. Add the matching layout item in the dashboard JSON `spec.layout.spec.items`.
7. Register the new `vizConfig.group` in the correct panel registry.
8. Render the panel through `DashboardDefinitionRenderer`, not page level grid markup.
9. Add a focused component spec or integration spec.

## Golden Path For Panel Settings

If the panel needs editable settings:

1. Define a typed settings shape close to the panel composition.
2. Put the persisted values in `panel.spec.vizConfig.spec.options`.
3. Add a `DashboardPanelSettingsRegistration` entry to the settings registry for that dashboard.
4. Keep the settings editor UI in the shared settings drawer flow.
5. Use `useDashboardPanelSettings(panelId, defaultSettings)` inside the panel rendering path.
6. Make defaults safe when persisted settings are missing or partial.
7. Keep public edits local.
8. Keep admin saves routed through `/api/dashboard/settings/dashboards/[dashboardUid]`.

Do not build one off settings UIs inside panel headers or page sidebars for dashboard panels.

## Structural Rules

1. `DashboardGridPanel` is only for dashboard grid panels
2. dialogs, popovers, hover cards, and floating shells must stay separate from dashboard grid structure
3. panel identity is stable data, not inferred from render order
4. `panelId` and `vizConfig.group` are persistence sensitive, so do not rename them casually
5. layout changes belong in dashboard JSON, not in ad hoc page JSX
6. renderer selection belongs in `createPanelRegistry(...)`

## File Placement

Typical files touched by a new panel:

1. `ui/compositions/<PanelName>/<PanelName>.tsx`
2. `ui/compositions/<PanelName>/<PanelName>.spec.tsx`
3. `ui/compositions/<PanelName>/index.ts`
4. `src/lib/dashboard/definitions/<dashboard>.json`
5. the relevant panel registry file

Potential files touched when settings are involved:

1. `ui/compositions/DashboardGrid/DashboardGrid.tsx`
2. `ui/compositions/DashboardDefinitionRenderer/DashboardGridRuntime.tsx`
3. `src/lib/dashboard/settings.ts`

## Testing Expectations

At minimum, cover the behavior that matters:

1. the panel renders through the registry
2. the dashboard definition still parses
3. settings update through the shared drawer if the panel has settings
4. saved or built in settings are reflected on initial render when relevant

Use the existing dashboard tests as references:

1. `tests/dashboard-schema.test.ts`
2. `tests/dashboard-registry.test.ts`
3. `ui/compositions/DashboardGrid/DashboardGrid.spec.tsx`
4. `ui/compositions/DashboardDefinitionRenderer/DashboardDefinitionRenderer.spec.tsx`
5. `ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView.spec.tsx`

## When Helping

When a user asks for a new dashboard panel:

1. identify the target dashboard
2. inspect the existing dashboard JSON and registry first
3. add the panel through the data model
4. only then add the composition code
5. if settings are needed, route them through the shared settings system
6. avoid page specific shortcuts that bypass the renderer

## Critical Rules

1. dashboard membership and layout live in dashboard JSON
2. panel rendering is resolved by `vizConfig.group`
3. dashboard grid chrome is shared and should not be reimplemented panel by panel
4. panel settings belong in the shared settings drawer architecture
5. public preview and admin persistence are both part of the panel settings contract
