import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Product site, app catalog/i })).toBeVisible();
});

test('docs page renders', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.getByRole('heading', { name: /Consumer API Documentation/i })).toBeVisible();
});
