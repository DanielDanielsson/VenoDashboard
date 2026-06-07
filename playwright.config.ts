import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001';
const port = new URL(baseURL).port || '3001';
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const useMockApi = process.env.PLAYWRIGHT_MOCK_API === '1';
const mockApiPort = process.env.PLAYWRIGHT_MOCK_API_PORT || '3101';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 8_000
  },
  webServer: [
    ...(useMockApi
      ? [{
          command: `node tests/e2e/mock-api-server.mjs`,
          url: `http://127.0.0.1:${mockApiPort}/api/v1/dashboards`,
          reuseExistingServer: true,
        }]
      : []),
    ...(!useExternalServer
      ? [{
          command: `npm run dev -- --port ${port}`,
          url: `${baseURL}/dashboard/about`,
          reuseExistingServer: true,
        }]
      : []),
  ],
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
