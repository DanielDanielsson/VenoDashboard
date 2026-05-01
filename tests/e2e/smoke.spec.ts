import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

test('dashboard renders', async ({ page }) => {
  await page.goto('/dashboards');
  await expect(page.getByRole('link', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Statistics', exact: true })).toBeVisible();
});

test('statistics page renders', async ({ page }) => {
  await page.goto('/dashboards/statistics');
  await expect(page.getByRole('heading', { name: /Statistics/i })).toBeVisible();
  await expect(page.getByText(/Deep dive into your glucose data/i)).toBeVisible();
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

test('statistics time range picker resolves theme colors after theme changes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pulse-theme', 'dark');
  });

  await page.goto('/dashboards/statistics');

  const darkPicker = await openTimeRangePicker(page);
  await expectResolvedThemeSurface(darkPicker.toolbar);
  await expectResolvedThemeSurface(darkPicker.panel);

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

  const lightPicker = await openTimeRangePicker(page);
  await expectResolvedThemeSurface(lightPicker.toolbar);
  await expectResolvedThemeSurface(lightPicker.panel);
});
