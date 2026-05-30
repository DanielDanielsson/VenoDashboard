import { expect, test, type Page } from '@playwright/test';
import {
  fetchDashboardRecords,
  findDashboardWithPanelGroups,
  getDashboardHref,
  readLocalEnvValue,
  type DashboardRecord,
} from './dashboard-fixtures';

const ownerUsername = readLocalEnvValue('OWNER_LOGIN_USERNAME') || 'admin';
const ownerPassword = readLocalEnvValue('OWNER_LOGIN_PASSWORD');

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function openPanelMenu(page: Page, title: string) {
  const panel = page.locator('[data-dashboard-panel-id]').filter({
    has: page.getByRole('heading', { name: new RegExp(`^${escapeRegExp(title)}$`, 'i') }),
  }).first();

  await panel.hover();
  await page.getByRole('button', { name: `Open panel actions for ${title}` }).click();
  await expect(page.getByRole('menu', { name: `Panel actions for ${title}` })).toBeVisible();
}

async function openPanelSettings(page: Page, title: string) {
  await openPanelMenu(page, title);
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const drawer = page.getByRole('complementary', { name: `Panel settings for ${title}` });
  await expect(drawer).toBeVisible();
  return drawer;
}

async function signInAsOwner(page: Page, dashboard: DashboardRecord) {
  const dashboardHref = getDashboardHref(dashboard);

  await page.goto(`/login?callbackUrl=${encodeURIComponent(dashboardHref)}`);
  await page.getByLabel('Username').fill(ownerUsername);
  await page.getByLabel('Password').fill(ownerPassword ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(dashboardHref)}$`));
}

async function setTimeInRangeLayout(page: Page, label: 'Overview' | 'Statistics') {
  const drawer = await openPanelSettings(page, 'Time in Range');
  await drawer.getByRole('button', { name: label }).click();
  return drawer;
}

test('time range dashboard supports panel view, edit, and public local preview', async ({ page, request }) => {
  const dashboard = findDashboardWithPanelGroups(await fetchDashboardRecords(request), [
    'veno.time-in-range',
    'veno.glucose-timeline',
  ]);
  if (!dashboard) {
    test.skip(true, 'The dashboard API did not return a time range dashboard with the architecture panels.');
    return;
  }

  await page.goto(getDashboardHref(dashboard));

  await expect(page.getByRole('heading', { name: dashboard.title })).toBeVisible();
  await expect(page.locator('h2').filter({ hasText: /^Time in Range$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Glucose Timeline' })).toBeVisible();
  const timeInRangeActions = page.getByRole('button', { name: 'Open panel actions for Time in Range' });
  await expect(timeInRangeActions).toHaveClass(/opacity-0/);
  await page.locator('[data-dashboard-panel-id]').filter({
    has: page.getByRole('heading', { name: /^Time in Range$/i }),
  }).first().hover();
  await expect(timeInRangeActions).toHaveClass(/opacity-100/);
  await expect(page.getByRole('button', { name: '24d' })).toHaveCount(0);

  await openPanelMenu(page, 'Time in Range');
  await page.getByRole('menuitem', { name: 'View' }).click();

  await expect(page.getByRole('button', { name: 'to dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Time in Range' })).toBeVisible();
  await page.getByRole('button', { name: 'to dashboard' }).click();

  const hadOverviewLayout = await page.locator('h2').filter({ hasText: /^Time In Range$/ }).count();
  const targetLayout = hadOverviewLayout ? 'Statistics' : 'Overview';
  const expectedHeading = targetLayout === 'Overview' ? /^Time In Range$/ : /^Time in Range$/;
  const drawer = await setTimeInRangeLayout(page, targetLayout);

  await expect(page.getByRole('button', { name: '24d' })).toHaveCount(0);
  await expect(page.locator('h2').filter({ hasText: expectedHeading })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Save' })).toBeEnabled();
  await expect(drawer.getByText('Admin sign in is required to save dashboard settings.')).toBeVisible();
  await drawer.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Admin sign in required')).toBeVisible();
  await expect(page.getByText('Sign in with admin access before saving dashboard changes.')).toBeVisible();
});

test('admin can save panel settings when the backend dashboard settings path is available', async ({ page }) => {
  test.skip(!ownerPassword, 'OWNER_LOGIN_PASSWORD is required for the admin persistence flow.');

  const dashboard = findDashboardWithPanelGroups(await fetchDashboardRecords(page.request), [
    'veno.time-in-range',
    'veno.glucose-timeline',
  ]);
  if (!dashboard) {
    test.skip(true, 'The dashboard API did not return a time range dashboard with the architecture panels.');
    return;
  }

  await signInAsOwner(page, dashboard);

  const hadOverviewLayout = await page.locator('h2').filter({ hasText: /^Time In Range$/ }).count();
  const originalLayout = hadOverviewLayout ? 'overview' : 'statistics';
  const restoreLabel = hadOverviewLayout ? 'Overview' : 'Statistics';
  const targetLabel = hadOverviewLayout ? 'Statistics' : 'Overview';

  const settingsPath = `/api/dashboard/settings/dashboards/${encodeURIComponent(dashboard.uid)}`;
  const probeResponse = await page.request.put(settingsPath, {
    data: {
      expectedVersion: null,
      panelSettings: {
        'panel-time-in-range': { layout: originalLayout },
      },
    },
  });

  test.skip(
    probeResponse.status() !== 200,
    `Dashboard settings backend is unavailable locally. Probe status was ${probeResponse.status()}.`,
  );

  let restoreNeeded = false;

  try {
    const drawer = await setTimeInRangeLayout(page, targetLabel);
    await expect(drawer.getByRole('button', { name: 'Save' })).toBeEnabled();

    const saveResponsePromise = page.waitForResponse((response) => (
      response.url().includes(settingsPath) &&
      response.request().method() === 'PUT'
    ));

    await drawer.getByRole('button', { name: 'Save' }).click();

    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(200);
    restoreNeeded = true;

    await expect(drawer.getByRole('button', { name: 'Save' })).toBeDisabled();
    await page.reload();

    if (targetLabel === 'Overview') {
      await expect(page.locator('h2').filter({ hasText: /^Time In Range$/ })).toBeVisible();
    } else {
      await expect(page.locator('h2').filter({ hasText: /^Time in Range$/ })).toBeVisible();
    }
  } finally {
    if (!restoreNeeded) {
      return;
    }

    const drawer = await setTimeInRangeLayout(page, restoreLabel);
    const restoreResponsePromise = page.waitForResponse((response) => (
      response.url().includes(settingsPath) &&
      response.request().method() === 'PUT'
    ));

    await drawer.getByRole('button', { name: 'Save' }).click();
    await restoreResponsePromise;
  }
});
