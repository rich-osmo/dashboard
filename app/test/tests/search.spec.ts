import { test, expect } from '@playwright/test';

test.describe('search overlay', () => {
  test('opens with Cmd+K and closes with Escape', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');

    await page.keyboard.press('Meta+k');
    await expect(page.locator('.search-overlay')).toBeVisible();
    await expect(page.locator('.search-input')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('.search-overlay')).not.toBeVisible();
  });

  test('shows page commands when empty', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    await page.keyboard.press('Meta+k');

    await expect(page.locator('.search-category-label:has-text("Go to")')).toBeVisible();
    expect(await page.locator('.search-result-item').count()).toBeGreaterThan(0);
  });

  test('typing filters results', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    await page.keyboard.press('Meta+k');

    await page.locator('.search-input').fill('notes');
    // Use .first() since "Notes" can match multiple results (page command + shortcut hint)
    await expect(page.locator('.search-result-item:has-text("Notes")').first()).toBeVisible();
  });

  test('selecting a page command navigates', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    await page.keyboard.press('Meta+k');

    await page.locator('.search-input').fill('team');
    await expect(page.locator('.search-result-item:has-text("Team")').first()).toBeVisible();
    await page.keyboard.press('Enter');

    await page.waitForURL(/\/team/);
    await expect(page.locator('.search-overlay')).not.toBeVisible();
  });

  test('arrow keys change selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    await page.keyboard.press('Meta+k');

    await expect(page.locator('.search-result-item.selected').first()).toBeVisible();

    await page.keyboard.press('ArrowDown');
    const selectedItems = page.locator('.search-result-item.selected');
    await expect(selectedItems).toHaveCount(1);
  });

  test('Tab switches to note mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    await page.keyboard.press('Meta+k');

    await page.keyboard.press('Tab');
    await expect(page.locator('.search-mode-badge:has-text("Note")')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.search-mode-badge')).not.toBeVisible();
  });

  test('external toggle button works', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    await page.keyboard.press('Meta+k');

    const toggle = page.locator('.search-external-toggle');
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveClass(/active/);

    await toggle.click();
    await expect(toggle).not.toHaveClass(/active/);
  });
});
