import { test, expect } from '@playwright/test';

test.describe('dashboard page', () => {
  test('page loads with Today heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1:has-text("Today")')).toBeVisible({ timeout: 10000 });
  });

  test('priorities section renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#priorities')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Priorities")')).toBeVisible();
    await expect(page.locator('.priorities-refresh-btn')).toBeVisible();
  });

  test('dashboard cards render', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dashboard-grid')).toBeVisible({ timeout: 10000 });
    const cards = page.locator('.dashboard-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);

    const h3Texts = await page.locator('.dashboard-card h3').allTextContents();
    expect(h3Texts).toContain('Calendar');
    expect(h3Texts).toContain('Status');
  });

  test('news section renders below dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dashboard-grid')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("News")')).toBeVisible();
  });

  test('priorities refresh button works', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.priorities-refresh-btn')).toBeVisible({ timeout: 10000 });
    await page.locator('.priorities-refresh-btn').click();
    await expect(page.locator('.priorities-refresh-btn')).toContainText(/Refresh/);
  });
});
