import { expect, test } from '@playwright/test';

test('dashboard renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Statistics' })).toBeVisible();
});

test('statistics page renders', async ({ page }) => {
  await page.goto('/dashboard/statistics');
  await expect(page.getByRole('heading', { name: /Statistics/i })).toBeVisible();
  await expect(page.getByText(/Deep dive into your glucose data/i)).toBeVisible();
});
