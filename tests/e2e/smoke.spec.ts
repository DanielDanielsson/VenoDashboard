import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

test('dashboard library renders API backed dashboards', async ({ page }) => {
  await page.goto('/dashboards');

  const dashboardLinks = page.getByRole('link', { name: /Open .+ dashboard/ });
  await expect(dashboardLinks.first()).toBeVisible();
  expect(await dashboardLinks.count()).toBeGreaterThan(0);
});

async function openFirstTimeRangeDashboard(page: Page, skipReason: string): Promise<string | null> {
  await page.goto('/dashboards');
  const row = page.getByRole('listitem').filter({
    has: page.getByText(/^Time range$/i),
  }).first();

  if (await row.count() === 0) {
    test.skip(true, skipReason);
    return null;
  }

  const link = row.getByRole('link', { name: /Open .+ dashboard/ }).first();
  const label = await link.getAttribute('aria-label');
  const title = label?.match(/^Open (.+) dashboard$/)?.[1] ?? '';

  await link.click();
  return title;
}

test('time range dashboard page renders', async ({ page }) => {
  const dashboardTitle = await openFirstTimeRangeDashboard(
    page,
    'The dashboard library did not render a time range dashboard.',
  );
  if (!dashboardTitle) {
    return;
  }

  await expect(page.getByRole('heading', { name: dashboardTitle })).toBeVisible();
  await expect(page.getByLabel(/Time range selected:/)).toBeVisible();
});

function isTransparentColor(value: string) {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  return normalized === '' || normalized === 'transparent' || normalized === 'rgba(0,0,0,0)';
}

async function expectResolvedThemeSurface(locator: Locator) {
  const styles = await locator.evaluate((element) => {
    const computed = window.getComputedStyle(element);

    return {
      backgroundColor: computed.backgroundColor,
      borderColor: computed.borderTopColor,
      borderWidth: computed.borderTopWidth,
      color: computed.color,
    };
  });

  expect(isTransparentColor(styles.backgroundColor)).toBe(false);
  expect(isTransparentColor(styles.borderColor)).toBe(false);
  expect(isTransparentColor(styles.color)).toBe(false);
  expect(styles.borderWidth).not.toBe('0px');
}

async function openTimeRangePicker(page: Page) {
  await page.getByLabel(/Time range selected:/).click();
  const panel = page.getByTestId('dashboard-time-range-picker-panel');
  await expect(panel).toBeVisible();

  return {
    panel,
    toolbar: page.getByTestId('dashboard-time-range-picker-toolbar'),
  };
}

test('time range picker resolves theme colors after theme changes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pulse-theme', 'dark');
  });

  const dashboardTitle = await openFirstTimeRangeDashboard(
    page,
    'The dashboard library did not render a time range dashboard.',
  );
  if (!dashboardTitle) {
    return;
  }

  const darkPicker = await openTimeRangePicker(page);
  await expectResolvedThemeSurface(darkPicker.toolbar);
  await expectResolvedThemeSurface(darkPicker.panel);

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

  const lightPicker = await openTimeRangePicker(page);
  await expectResolvedThemeSurface(lightPicker.toolbar);
  await expectResolvedThemeSurface(lightPicker.panel);
});
