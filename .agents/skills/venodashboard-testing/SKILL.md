---
name: venodashboard-testing
description: Add and maintain useful colocated tests for VenoDashboard components and run the local CI mirror before push
---

# VenoDashboard Testing

Use this when adding or changing tests in `VenoDashboard`.

## Overview

This repo expects colocated component specs and a local CI run before push.

The goal is not to maximize test count.

The goal is to protect real behavior:

1. component logic
2. state transitions
3. side effects
4. emitted events
5. routing decisions
6. theme and storage behavior
7. API request behavior

## Colocation Rules

For active UI pieces:

1. `ui/base/<Component>/<Component>.spec.tsx`
2. `ui/components/<Component>/<Component>.spec.tsx`

Use `.spec.ts` only when there is no JSX involved.

## What To Test

Write tests that are directly useful.

Good examples:

1. active and inactive button state
2. segmented control change behavior
3. hover panel open state and source text
4. theme toggle persistence and DOM side effects
5. sign-in and sign-out request behavior
6. date picker state and apply behavior
7. chart helper UI that appears only when certain data exists

Avoid:

1. snapshots with no behavioral assertion
2. tests that only restate class names unless that class is itself the public contract
3. broad rendering tests for layout-only wrappers with no meaningful logic

## Test Environment

Current split:

1. `tests/**/*.test.ts` for repo-level and server/helper tests
2. `ui/**/*.spec.tsx` for component tests

Component specs use `jsdom` and shared setup from:

1. `tests/setup.ts`

## Required Verification

Before pushing dashboard changes, prefer:

1. `npm run ci:local`

For this repo, commit requests should also follow this rule. Do not treat a commit request as complete until the local CI mirror has been run or a concrete blocker has been reported.

This mirrors the current GitHub Actions workflow:

1. lint
2. typecheck
3. unit tests
4. contract validation
5. link checks
6. build
7. Playwright smoke tests

If you only need targeted iteration while developing, run the narrower command first, but do not stop there before push.

## Critical Rules

1. every new active base or component folder should get a colocated spec if the component has behavior worth protecting
2. `npm run test` must stay green and must include the colocated component specs
3. if CI changes, update `npm run ci:local` to match it
4. do not add filler tests just to satisfy the folder rule
5. in `VenoDashboard`, a commit request implies running `npm run ci:local` before declaring the work ready
