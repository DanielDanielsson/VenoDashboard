---
name: venodashboard-panels
description: Create or refactor VenoDashboard dashboard panels using the JSON dashboard schema, panel catalog, panel registries, shared grid chrome, URL state, and settings drawer structure
---

# VenoDashboard Panels

Use this when adding, refactoring, wiring, debugging, or reviewing dashboard panels in `VenoDashboard`.

This skill keeps panel work aligned with the data driven dashboard architecture. A panel is never just JSX. It is dashboard data, catalog metadata, registry wiring, shared grid behavior, optional settings, and the rendered composition.

## Read First

Before changing panel structure, read only the files relevant to the dashboard being changed.

Core model:

1. `src/lib/dashboard/schema.ts`
2. `src/lib/dashboard/panel-catalog.ts`
3. `src/lib/dashboard/panel-registry.ts`
4. `src/lib/dashboard/settings.ts`
5. `src/lib/dashboard/resources.ts`

Built in dashboard definitions:

1. `src/lib/dashboard/definitions/overview.json`
2. `src/lib/dashboard/definitions/statistics.json`
3. `src/lib/dashboard/registry.ts`

Rendering and interactions:

1. `ui/compositions/DashboardDefinitionRenderer/DashboardDefinitionRenderer.tsx`
2. `ui/compositions/DashboardDefinitionRenderer/DashboardGridRuntime.tsx`
3. `ui/compositions/DashboardGrid/DashboardGrid.tsx`
4. `ui/compositions/DashboardGrid/DashboardGridPanel.tsx`
5. `ui/compositions/DashboardViewPanelUrlStateBridge/DashboardViewPanelUrlStateBridge.tsx`

Panel registries:

1. `ui/compositions/DashboardDefinitionRenderer/overviewPanelRegistry.tsx`
2. `ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView.tsx`

## Current Panels

Live dashboard panels:

1. `panel-current-glucose`, group `veno.live-glucose`, component `LiveGlucosePanel`
2. `panel-timers`, group `veno.shared-timers`, component `SharedTimersPanel`
3. `panel-connections`, group `veno.connections-map`, component `ConnectionsMapPanel`

Time range dashboard panels:

1. `panel-average-glucose`, group `veno.average-glucose`, rendered inside `GlucoseAnalysisView`
2. `panel-time-in-range`, group `veno.time-in-range`, component `TimeInRangePanel`
3. `panel-workout-types`, group `veno.workout-types`, component `WorkoutTypePanel`
4. `panel-glucose-timeline`, group `veno.glucose-timeline`, rendered inside `GlucoseAnalysisView`
5. `panel-agp`, group `veno.glucose-agp`, rendered inside `GlucoseAnalysisView`

Reusable chart components:

1. `ui/components/PieChart`
2. `ui/components/LineChart`
3. `ui/components/HistogramChart`
4. `ui/components/GlucoseChart`
5. `ui/components/GlucoseAgpChart`

Panel specific data shaping should live beside the panel when possible. Current examples are `ui/compositions/TimeInRangePanel/timeInRangeChart.ts` and `ui/compositions/WorkoutTypePanel/workoutTypeChart.ts`.

## Panel Anatomy

Every persisted panel has these parts:

1. an entry in `dashboard.spec.elements`
2. a matching item in `dashboard.spec.layout.spec.items`
3. a stable element key such as `panel-time-in-range`
4. a stable `panel.spec.vizConfig.group` such as `veno.time-in-range`
5. a `DASHBOARD_PANEL_CATALOG` entry when the panel can be added to user dashboards
6. a registry entry that maps the group to rendered React content
7. optional settings stored in `panel.spec.vizConfig.spec.options`
8. optional settings editor registration for the shared right side settings drawer

`parseDashboardDefinition` fills missing `data`, `options`, and `fieldConfig` defaults. Do not rely on that as an excuse to create incomplete hand written definitions when adding new built in panels.

## Dashboard Types

The app supports two dashboard types:

1. `live`
2. `timeRange`

Rules:

1. live dashboards render through `OverviewDashboardView` and `DashboardDefinitionRenderer`
2. time range dashboards render through `GlucoseAnalysisView`
3. a panel belongs to exactly one dashboard type in `DASHBOARD_PANEL_CATALOG`
4. `validateDashboardPanelCompatibility` rejects unknown groups and cross type panels
5. user created dashboards use the same catalog, renderer, grid, add panel drawer, settings save path, and compatibility checks as built in dashboards
6. do not add a mixed dashboard escape hatch in V1

## Golden Path For A New Panel

Follow this order.

1. Decide whether the panel is `live` or `timeRange`.
2. Check if an existing panel or reusable chart component can be reused.
3. Create the rendering composition under `ui/compositions/<PanelName>/` when the panel has its own reusable surface.
4. Keep large data shaping helpers beside the composition.
5. Add or update the built in dashboard JSON only if the panel should ship on a built in dashboard.
6. Add the panel element under `spec.elements`.
7. Add the layout item under `spec.layout.spec.items`.
8. Add a `DASHBOARD_PANEL_CATALOG` entry with `id`, `elementName`, `title`, `group`, `compatibleDashboardType`, `allowMultiple`, `defaultLayout`, and `defaultDefinition`.
9. Register the group in the correct panel registry.
10. Render through `DashboardDefinitionRenderer`.
11. Add focused tests for schema, catalog, registry, rendering, and settings behavior as applicable.

Do not hardcode dashboard grid JSX in page components.

Catalog layout rules:

1. `defaultLayout.width` and `defaultLayout.height` are grid units, not pixels
2. dashboard columns are fixed count grid units and dashboard rows are pixel based height units
3. when adding a panel to the catalog, include `defaultLayout.aspectRatio` when the panel has a preferred visual shape
4. `DashboardGrid` uses `defaultLayout.aspectRatio` to calculate a sensible starting height when a user adds a panel
5. keep `defaultLayout.height` as a fallback for old callers, invalid aspect ratios, and non measured grid states
6. choose aspect ratios based on the rendered panel content, not on the current built in dashboard placement alone

## Settings Path

Use settings only when the panel has user adjustable behavior.

Rules:

1. persisted settings live in `panel.spec.vizConfig.spec.options`
2. default settings live near the panel composition
3. the panel reads settings through `useDashboardPanelSettings(panelId, defaultSettings)`
4. settings UI belongs in a `DashboardPanelSettingsRegistration`
5. the settings editor renders in the shared right side drawer owned by `DashboardGrid`
6. public visitors may preview changes locally
7. admin users persist changes through `/api/dashboard/settings/dashboards/[dashboardUid]`
8. merge defaults with persisted settings so partial saved state does not break rendering
9. never build a panel specific settings drawer, popover, or toolbar beside the panel header
10. settings that change the desired panel shape should call the shared layout helper from the settings registration, not mutate dashboard JSON directly
11. prefer `resizeLayoutToAspectRatio` for shape changes instead of swapping grid `width` and `height`
12. use explicit min and max width and height bounds when a setting can resize a panel

Known settings:

1. `panel-time-in-range` stores `layout`
2. `panel-glucose-timeline` stores `colorMode` and `yAxisMax`
3. AGP currently reuses the glucose timeline `yAxisMax` setting
4. `panel-current-glucose` stores `contentAlignment`, `colorMode`, unit, and information label visibility

## URL And Interaction Rules

Solo panel view:

1. `viewPanel` is the URL parameter
2. values should use stable panel keys like `panel-time-in-range`
3. legacy numeric ids are aliases only
4. `DashboardViewPanelUrlStateBridge` owns validation, aliases, normalization, and URL updates
5. changing the time range must preserve any active `viewPanel`

Panel menu rules:

1. action buttons are mounted by `DashboardGridPanel`
2. actions are hidden until panel hover or menu open
3. the three dot menu works outside edit mode
4. `Edit` enters dashboard edit mode and opens the shared settings drawer
5. `View` enters solo panel view and updates `viewPanel`
6. hovering a panel and pressing `V` toggles solo view
7. keyboard shortcuts are ignored inside inputs, textareas, selects, and editable content
8. solo view renders the `to dashboard` action in the same toolbar row as `Edit`

## Layout Rules

1. dashboard membership lives in `spec.elements`
2. dashboard layout lives in `spec.layout.spec.items`
3. each layout item references an element by name
4. `DashboardGridPanel` is only for dashboard grid panels
5. dialogs, popovers, hover cards, and other floating layers stay outside dashboard grid structure
6. grid move animations should only run while editing layout
7. solo view should size the selected panel to the remaining viewport height and avoid page scroll
8. do not assume grid width and grid height use the same unit
9. do not swap grid width and grid height to rotate a panel shape
10. use pixel aware aspect ratio resizing for setting driven shape changes

Aspect ratio rules:

1. `DashboardGrid` owns the conversion between grid units and pixels
2. columns are based on available container width
3. rows are based on configured row height and row margin
4. aspect ratio resizing should preserve roughly the current panel pixel area
5. aspect ratio resizing should then convert the target pixel size back into grid width and height
6. clamp resized panels with panel specific minimum and maximum grid dimensions
7. avoid saving setting driven layout changes from narrow non draggable layouts
8. use CSS responsiveness inside the panel for mobile and compact layouts
9. if a panel has several content modes, define a target aspect ratio for each mode near the panel settings registration
10. if a panel is addable, define a default catalog aspect ratio so newly added panels start with a sensible size

## Panel Content Sizing

Panel content must be designed to use the full available panel width and height.

Rules:

1. panel content should fill the grid panel body instead of sizing itself as a fixed static block
2. chart, table, metric, and control layouts must scale when users resize dashboard panels
3. prefer flexible containers, responsive chart dimensions, and bounded overflow behavior
4. avoid fixed pixel dimensions inside panel content unless they are a deliberate minimum or maximum
5. empty, loading, and error states must also fill and align within the available panel area
6. compact panel sizes should preserve readable content instead of clipping labels or overlapping controls
7. large panel sizes should use the added space meaningfully instead of leaving the visualization stranded in one corner
8. test resize behavior when a panel introduces new layout, charts, controls, or dense text
9. test setting driven aspect ratio changes across at least one compact and one wide viewport when practical
10. panel content should adapt when the grid layout changes aspect ratio, not rely on fixed pixel positions

## Naming Rules

1. use stable element keys like `panel-time-in-range`
2. use stable group names like `veno.time-in-range`
3. avoid renaming element keys, numeric ids, or group names because saved dashboard settings depend on them
4. use catalog `id` values that describe the add panel option, such as `time-in-range`
5. keep titles user facing and concise

## Data And Ownership Rules

1. browser components should use local `/api/dashboard/*` routes for privileged reads
2. panel code should not talk directly to `VenoAPI`
3. live dashboard context belongs in live dashboard loading code, not inside every panel
4. time range panel data should follow the `GlucoseAnalysisView` selection and URL state path when it depends on the selected range
5. timer stream ownership stays in `DashboardTimersBridge`
6. `SharedTimersPanel` reacts to shared browser timer events instead of opening its own `EventSource`

## Testing Expectations

At minimum, cover the behavior changed by the panel.

Useful tests:

1. `tests/dashboard-schema.test.ts`
2. `tests/dashboard-registry.test.ts`
3. `tests/dashboard-panel-catalog.test.ts`
4. `tests/dashboard-panel-registry.test.ts`
5. `ui/compositions/DashboardDefinitionRenderer/DashboardDefinitionRenderer.spec.tsx`
6. `ui/compositions/DashboardDefinitionRenderer/DashboardGridRuntime.spec.tsx`
7. `ui/compositions/DashboardGrid/DashboardGrid.spec.tsx`
8. `ui/compositions/DashboardViewPanelUrlStateBridge/DashboardViewPanelUrlStateBridge.spec.tsx`
9. the colocated panel spec
10. `tests/e2e/dashboard-architecture.spec.ts` when the visible dashboard flow changes

Test these cases when relevant:

1. dashboard definition still parses
2. catalog exposes the panel only for the compatible dashboard type
3. registry resolves the group
4. add panel drawer can add the default definition
5. settings read defaults and persisted values
6. settings save through shared grid state
7. solo view URL state still works
8. menu and keyboard interactions still work
9. panel content fills the panel body and scales across edited panel sizes
10. catalog aspect ratios produce sensible added panel dimensions
11. setting driven aspect ratio updates save through the same dashboard layout save path
12. aspect ratio resizing does not run on narrow non draggable layouts

## Red Flags

Stop and rethink if the change does any of these:

1. adds panel markup directly to a page route
2. bypasses `DashboardDefinitionRenderer`
3. creates a panel without a catalog entry when it should be addable
4. creates a catalog entry without a registry entry
5. stores persisted settings somewhere other than `vizConfig.spec.options`
6. duplicates shared grid chrome
7. adds native styled selects for dashboard controls
8. adds feature specific toast containers
9. renames stable panel ids or groups without a migration
10. lets live and time range panels mix without catalog validation
11. swaps grid width and height as if they were the same unit
12. changes panel layout from settings without using the shared grid layout path
