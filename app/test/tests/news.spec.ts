import { test, expect } from '@playwright/test';

test.describe('news page', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/news');
    await expect(page.locator('h1')).toContainText('News');
  });

  test('news feed or empty state renders', async ({ page }) => {
    await page.goto('/news');
    // Either news items exist or we get an empty state
    const hasItems = await page.locator('.news-item').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('.empty-state').first().isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBeTruthy();
  });

  test('news items have titles', async ({ page }) => {
    await page.goto('/news');
    const items = page.locator('.news-item');
    if (await items.count() > 0) {
      // Each item should have a title element
      await expect(items.first().locator('.news-item-title')).toBeVisible();
    }
  });
});
