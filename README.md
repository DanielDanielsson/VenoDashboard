# VenoDashboard

Private dashboard frontend for Veno ecosystem.

## Scope

- `/login`
- `/dashboard`
- `/dashboard/glucose`
- `/dashboard/settings`
- `/dashboard/integrations`
- `/dashboard/api-keys`
- `/api/auth/*`
- `/api/dashboard/*`

## Environment

Copy `.env.example` to `.env.local`:

```bash
AUTH_POC_EMAIL=admin@veno.local
OWNER_LOGIN_USERNAME=admin
OWNER_LOGIN_PASSWORD=change_me_admin_password
NEXT_PUBLIC_SITE_URL=http://localhost:3001
PULSE_API_BASE_URL=http://localhost:3101
DEXCOM_GATEWAY_BASE_URL=http://localhost:3101
PULSE_API_ADMIN_TOKEN=replace_with_existing_api_admin_bearer_token
DEXCOM_GATEWAY_ADMIN_TOKEN=replace_with_existing_gateway_admin_bearer_token
PULSE_API_STATUS_TOKEN=optional_existing_status_page_token
```

## Contracts

Public demo routes:

- `/dashboard`
- `/dashboard/statistics`

Admin sign in is still required for settings, integrations, API keys, and timer mutations.

- Source of truth is VenoAPI.
- Contract fetch targets:
  - `${PULSE_API_BASE_URL}/docs/openapi.json`
  - `${PULSE_API_BASE_URL}/docs/agent-context.json`
- Fallback snapshots stay in `content/contracts/*.snapshot.json` when remote fetch fails.
- CI contract validation should set repository variable `VENO_API_BASE_URL`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run test:links`
- `npm run contracts:validate`

## Docker

- Build image: `docker build -t veno-dashboard .`
- Local compose: `docker compose up --build`
