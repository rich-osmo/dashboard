import { test, expect } from '@playwright/test';

test.describe('settings page', () => {
  test('page loads with headings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Connections")')).toBeVisible();
  });

  test('auth cards render for services', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.auth-grid')).toBeVisible({ timeout: 10000 });
    const cards = page.locator('.auth-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });

  test('each card has title and status badge', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.auth-grid')).toBeVisible({ timeout: 10000 });
    const cards = page.locator('.auth-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await expect(card.locator('.auth-card-title')).toBeVisible();
      await expect(card.locator('.auth-badge')).toBeVisible();
    }
  });

  test('page action buttons exist', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.auth-page-actions')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Re-check All")')).toBeVisible();
    await expect(page.locator('button:has-text("Sync All Sources")')).toBeVisible();
  });

  test('re-check all button refetches', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.auth-page-actions')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Re-check All")').click();
    await expect(page.locator('.auth-card').first()).toBeVisible();
  });
});
