import { test, expect } from '@playwright/test';

test.describe('issues page', () => {
  test('page loads with heading and input', async ({ page }) => {
    await page.goto('/issues');
    await expect(page.locator('h1')).toContainText('Issues');
    await expect(page.locator('.note-input')).toBeVisible();
  });

  test('filter buttons include in progress', async ({ page }) => {
    await page.goto('/issues');
    await expect(page.locator('.filter-btn:has-text("open")')).toBeVisible();
    await expect(page.locator('.filter-btn:has-text("in progress")')).toBeVisible();
    await expect(page.locator('.filter-btn:has-text("done")')).toBeVisible();
    await expect(page.locator('.filter-btn:has-text("all")')).toBeVisible();

    // Toggle through filters
    await page.locator('.filter-btn:has-text("in progress")').click();
    await expect(page.locator('.filter-btn:has-text("in progress")')).toHaveClass(/active/);

    await page.locator('.filter-btn:has-text("all")').click();
    await expect(page.locator('.filter-btn:has-text("all")')).toHaveClass(/active/);

    await page.locator('.filter-btn:has-text("open")').click();
    await expect(page.locator('.filter-btn:has-text("open")')).toHaveClass(/active/);
  });

  test('create an issue with size and priority', async ({ page }) => {
    await page.goto('/issues');
    const uniqueText = `[m] /p2 Test issue ${Date.now()}`;

    await page.locator('.note-input').fill(uniqueText);
    // Should show parsing hint
    await expect(page.locator('.note-link-hint')).toBeVisible();

    await page.locator('.note-input').press('Enter');

    // Issue should appear (the title is parsed from the input minus the prefix)
    await page.waitForTimeout(1000);
    // Switch to all filter to see it
    await page.locator('.filter-btn:has-text("all")').click();
    const issues = page.locator('.issue-item');
    expect(await issues.count()).toBeGreaterThanOrEqual(1);
  });

  test('issue items are visible after creation', async ({ page }) => {
    await page.goto('/issues');
    await page.locator('.filter-btn:has-text("all")').click();

    const items = page.locator('.issue-item');
    if (await items.count() > 0) {
      // Each issue should have a title
      await expect(items.first().locator('.issue-title')).toBeVisible();
    }
  });
});
