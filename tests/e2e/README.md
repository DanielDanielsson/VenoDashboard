# Dashboard architecture e2e coverage

This folder includes the end to end checks for the dashboard architecture work.

## What is covered

1. Dashboard pages load through the JSON driven renderer.
2. Panel action menus open from the panel chrome.
3. `View` focuses a panel in the dashboard area.
4. `Edit` opens the settings drawer.
5. Public visitors can preview panel setting changes locally and see disabled `Save`.
6. Admin save and refresh persistence is verified when the dashboard settings backend path is available.

## Backend dependent coverage

The admin persistence check is intentionally conditional.

It only runs when all of these are true:

1. `OWNER_LOGIN_PASSWORD` is available to Playwright, either from the shell or `.env.local`.
2. The dashboard app can log in successfully.
3. The API exposes at least one dashboard containing the Time in Range and Glucose Timeline panels.
4. `PUT /api/dashboard/settings/dashboards/{dashboardUid}` returns `200` through the local dashboard route.

If the local VenoAPI only exposes the dashboard settings contract and not the live persistence route yet, the admin persistence test is skipped instead of being faked.

## Manual follow up when the backend is missing

1. Start the VenoAPI version that implements `/api/admin/dashboard-settings/{dashboardUid}`.
2. Run `npm run test:e2e`.
3. Confirm the admin persistence test no longer skips.
