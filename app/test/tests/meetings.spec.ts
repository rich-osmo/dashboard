import { test, expect } from '@playwright/test';

test.describe('meetings page', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/meetings');
    await expect(page.locator('h1')).toContainText('Meetings');
  });

  test('tabs render: Upcoming and Past', async ({ page }) => {
    await page.goto('/meetings');
    await expect(page.locator('.tab-bar')).toBeVisible();
    await expect(page.locator('.tab:has-text("Upcoming")')).toBeVisible();
    await expect(page.locator('.tab:has-text("Past")')).toBeVisible();
  });

  test('switching tabs works', async ({ page }) => {
    await page.goto('/meetings');

    // Click Past tab
    await page.locator('.tab:has-text("Past")').click();
    await expect(page.locator('.tab:has-text("Past")')).toHaveClass(/active/);
    await expect(page.locator('.tab:has-text("Upcoming")')).not.toHaveClass(/active/);

    // Click Upcoming tab
    await page.locator('.tab:has-text("Upcoming")').click();
    await expect(page.locator('.tab:has-text("Upcoming")')).toHaveClass(/active/);
  });

  test('meeting entries or empty state renders', async ({ page }) => {
    await page.goto('/meetings');
    // Wait for loading to finish, then check for entries or empty state
    await page.waitForSelector('.meeting-entry, .empty-state', { timeout: 10000 });
  });
});
