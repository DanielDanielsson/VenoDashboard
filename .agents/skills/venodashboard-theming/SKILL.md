---
name: venodashboard-theming
description: Apply VenoDashboard rules for design tokens, theme inheritance, and reusable component structure
---

# VenoDashboard Theming

Use this when working on styling, theming, colors, or component structure in `VenoDashboard`.

## Overview

This skill exists to keep theming decisions consistent across the repo.

The main idea is simple:

1. raw design tokens live in `src/styles/config/colors.css`
2. font roles live in `src/styles/config/font-styles.css`
3. component theme files map local vars from those shared tokens
4. TSX should consume named classes, not raw CSS variable expressions or inline style when avoidable
5. theme should inherit automatically unless a component is explicitly overriding it

## File Ownership

### Colors

Raw color tokens belong in:

1. `src/styles/config/colors.css`

Rules:

1. all shared color tokens must start with `--color-base-`
2. never put component names in `colors.css`
3. never define the same raw color under multiple token names
4. if a new color is needed, give it a general name that can be reused by more than one component

### Fonts

Font utilities belong in:

1. `src/styles/config/font-styles.css`

Rules:

1. use shared font utility classes instead of ad hoc Tailwind font size and weight classes
2. if a font role is missing, add a new utility there first
3. prefer those utilities in TSX, SVG text, chart labels, and helper text

### Component Theme Files

Component theme files belong next to the component, for example:

1. `ui/components/DashboardPanel/dashboardPanel.css`
2. `ui/components/SecondaryButton/secondaryButton.css`
3. `ui/components/NumberInput/numberInput.css`

Rules:

1. component CSS may define local vars like `--color-dashboard-panel-bg`
2. those local vars should map from shared base tokens in `colors.css`
3. component CSS should not contain raw color literals when a base token can own that value
4. expose component vars through `@theme inline`

## Reuse Rules

Before making a new visual shell, check whether an existing component already solves most of the problem.

Current examples:

1. floating info panels should prefer reusing `ui/components/DashboardPanel/DashboardPanel.tsx`
2. click and hover triggers should prefer reusing `ui/base/Button/Button.tsx`
3. icon rendering should prefer `ui/base/Icon/Icon.tsx`

Do not create parallel button or panel systems unless there is a real structural reason.

## Theme Inheritance

Theme should come from the page automatically through CSS variable inheritance.

Rules:

1. do not pass `theme={isDark ? 'dark' : 'light'}` just to mirror the page theme
2. let components inherit the active page theme by default
3. keep `theme` props only as explicit overrides
4. avoid branching on light and dark in TSX when CSS inheritance already solves it

## TSX Rules

When styling inside TSX:

1. prefer named Tailwind classes backed by theme tokens
2. avoid arbitrary Tailwind classes that inject CSS variables directly for text, background, or border color
3. avoid inline `style` props when the same result can be expressed with existing classes
4. use `twMerge` for conditional class logic

## Golden Path For New Themed Components

Follow this path for every new component with local colors, borders, shadows, or theme behavior.

1. Read `src/styles/config/colors.css`.
2. Reuse existing `--color-base-*` tokens before adding new ones.
3. Add missing shared color tokens only in `src/styles/config/colors.css`.
4. Create or update a local component CSS file beside the component.
5. Map local component vars from base tokens inside `@layer theme`.
6. Expose every local component var through `@theme inline`.
7. Use named Tailwind classes in TSX, such as `bg-dashboard-panel-bg`.
8. Import the component CSS from the component entry point or component file.
9. Run `npm run gen:css` when component CSS files are added or removed.
10. Run `npm run theme:check`.
11. Verify computed styles in both light and dark mode with Playwright.

Known good component theme examples:

1. `ui/components/DashboardPanel/dashboardPanel.css`
2. `ui/components/SecondaryButton/secondaryButton.css`
3. `ui/components/NumberInput/numberInput.css`

## Transparent Color Checklist

Before finishing a themed component, inspect computed styles for key surfaces in both light and dark mode.

Use Playwright or DevTools to check:

```js
getComputedStyle(element).backgroundColor
getComputedStyle(element).borderColor
getComputedStyle(element).color
```

Reject these values for visible panels, controls, text, and borders:

```txt
transparent
rgba(0, 0, 0, 0)
```

For floating panels and popovers, also check that the panel border width is not `0px`.

## New Themed Component Template

Use this checklist when creating a new themed component.

1. Create `ComponentName.tsx`.
2. Create `componentName.css` beside it.
3. Map local vars from `--color-base-*` tokens.
4. Expose local vars through `@theme inline`.
5. Use only named Tailwind classes for themed colors in TSX.
6. Add a colocated component test for behavior.
7. Add or update a Playwright smoke test when the component has a visible page level surface.
8. Run `npm run gen:css`.
9. Run `npm run theme:check`.
10. Run `npm run lint -- --quiet`.
11. Run `npm run typecheck`.

## When Helping

When you touch theming or component styling in `VenoDashboard`:

1. read `src/styles/config/colors.css` first
2. read `src/styles/config/font-styles.css` if text styling is involved
3. check whether an existing component should be reused before making a new shell
4. if component theme vars are needed, create or update the local `*.css` file beside the component
5. map component vars from base tokens
6. keep page theme inheritance as the default behavior
7. run `npm run gen:css` if component CSS files are added or removed
8. run `npm run theme:check`
9. run at least:
   - `npm run lint -- --quiet`
   - `npm run typecheck`

## Critical Rules

1. `colors.css` is the only place raw design color tokens should be introduced
2. `font-styles.css` is the only place shared font roles should be introduced
3. do not duplicate the same raw color in multiple base tokens
4. do not hardcode page theme in TSX when inheritance already handles it
5. prefer reuse of `DashboardPanel`, `Button`, and other base primitives before inventing new component structure
