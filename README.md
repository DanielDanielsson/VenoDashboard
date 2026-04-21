<p align="center">
  <img src="./public/static_assets/veno-logo-readme.svg" alt="Veno logo" width="260" />
</p>

<p align="center">
  Demo-first glucose dashboard for the Veno platform.
</p>

## MVP Demo

The demo app is currently in MVP state and available here:

**https://app.venoplatform.com/dashboard**

Right now the public experience is focused on the dashboard overview and statistics pages. Admin sign in is still required for settings, API keys, timers, and other operational actions.

## What This Is

VenoDashboard is the frontend surface for the Veno ecosystem. It is built to visualize live glucose data, show trends over time, and act as a testing ground for new ideas around monitoring, health data UX, and product direction.

This project is closely tied to the work happening in the API layer. The dashboard consumes VenoAPI data, presents it in a cleaner way, and helps validate how the broader platform should feel when real data is flowing through it.

## Why It Exists

The project started as a practical way to summarize and visualize diabetes data in a way that feels more useful than the default tools. The data comes from a Dexcom sensor, a Tandem insulin pump, and step data from a phone, then gets shaped into a view that is easier to read and reason about.

It is also a side project built as a real product sandbox. The dashboard is where new visualizations, interaction patterns, and agent-assisted workflows can be tested quickly against actual use.

## Current Scope

- Public demo for overview and statistics
- Admin sign in for protected actions
- Glucose history and recent updates
- Time-in-range and AGP style analysis
- Connections and system status surfaces
- API key and settings management for admin users

## Notifications

The app now has a shared notification foundation mounted at the app root.

Use the shared notification hook in client components when feedback should appear above the current page state:

- `notify(title, options?)`
- `notifySuccess(title, options?)`
- `notifyWarning(title, options?)`
- `notifyError(title, options?)`

Current intent:

- one shared toast viewport in the top right
- one shared API for future cross-page feedback
- no feature-specific toast containers
- dashboard timer events are owned by a global timer bridge, so timer UI and timer notifications both react to the same stream source

## Environment

`VenoDashboard` should stay simple. These are the only env vars that matter in normal use:

- `PULSE_API_BASE_URL`
- `ADMIN_BEARER_TOKEN`
- `DEXCOM_GATEWAY_BASE_URL`
- `OWNER_LOGIN_USERNAME`
- `OWNER_LOGIN_PASSWORD`
- `NEXT_PUBLIC_SITE_URL`

Optional:

- `PULSE_API_CONSUMER_KEY`
- `DEXCOM_GATEWAY_ADMIN_TOKEN`
- `PULSE_API_STATUS_TOKEN`

Rules:

- Do not set `PULSE_API_ADMIN_TOKEN`. `VenoDashboard` does not use it anymore.
- Do not set `PULSE_API_TARGET`. `VenoDashboard` does not use target-scoped env logic anymore.
- If `PULSE_API_CONSUMER_KEY` is unset, consumer routes fall back to `ADMIN_BEARER_TOKEN`.
- If `DEXCOM_GATEWAY_ADMIN_TOKEN` is unset, Dexcom connect falls back to `ADMIN_BEARER_TOKEN`.
- On the VPS, `PULSE_API_BASE_URL` may be the internal Docker URL like `http://veno-api:3101`.
- On a laptop, `PULSE_API_BASE_URL` should point at the public API like `https://api.venoplatform.com` unless you are running `VenoAPI` locally.

Minimal local example against prod:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3001
PULSE_API_BASE_URL=https://api.venoplatform.com
DEXCOM_GATEWAY_BASE_URL=https://glucose-nu.vercel.app
ADMIN_BEARER_TOKEN=replace_with_prod_api_admin_bearer_token
OWNER_LOGIN_USERNAME=admin
OWNER_LOGIN_PASSWORD=replace_with_owner_password
```

Troubleshooting:

- If `/api/dashboard/status` works but glucose history, timers, or streams return `403`, the admin token is wrong.
- If prod works on the VPS and local does not, compare local `.env.local` with `VenoDeploy/.env` on the VPS.
- The deployed stack passes `ADMIN_BEARER_TOKEN` into both `veno-api` and `veno-dashboard`. That is the value local should mirror.
- For easy switching, keep the prod values first in `.env.local` and place a local override block with the same keys at the end.
- In Next.js env loading, the last duplicate key wins. Comment out the local override block to go back to prod.

## Docker

- `docker build -t veno-dashboard .`
- `docker compose up --build`
