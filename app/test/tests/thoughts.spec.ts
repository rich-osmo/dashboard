import { test, expect } from '@playwright/test';

test.describe('thoughts page', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/thoughts');
    await expect(page.locator('h1')).toContainText('Thoughts');
  });

  test('filter buttons work', async ({ page }) => {
    await page.goto('/thoughts');
    const filters = page.locator('.filter-btn');
    expect(await filters.count()).toBe(3);

    // Open is default
    await expect(page.locator('.filter-btn.active')).toContainText('open');

    // Toggle through filters
    await page.locator('.filter-btn:has-text("done")').click();
    await expect(page.locator('.filter-btn:has-text("done")')).toHaveClass(/active/);

    await page.locator('.filter-btn:has-text("all")').click();
    await expect(page.locator('.filter-btn:has-text("all")')).toHaveClass(/active/);
  });

  test('textarea input at bottom of page', async ({ page }) => {
    await page.goto('/thoughts');
    await expect(page.locator('textarea[placeholder="What\'s on your mind?"]')).toBeVisible();
    await expect(page.locator('button:has-text("Save thought")')).toBeVisible();
  });

  test('create a thought', async ({ page }) => {
    await page.goto('/thoughts');
    const uniqueText = `Thought test ${Date.now()}`;

    const textarea = page.locator('textarea[placeholder="What\'s on your mind?"]');
    await textarea.fill(uniqueText);
    await page.locator('button:has-text("Save thought")').click();

    // Thought should appear in the list (displayed without [t] prefix)
    await expect(page.locator(`.note-item:has-text("${uniqueText}")`)).toBeVisible({ timeout: 5000 });
  });

  test('toggle thought status', async ({ page }) => {
    await page.goto('/thoughts');

    // Create a thought to toggle
    const uniqueText = `Toggle thought ${Date.now()}`;
    const textarea = page.locator('textarea[placeholder="What\'s on your mind?"]');
    await textarea.fill(uniqueText);
    await page.locator('button:has-text("Save thought")').click();
    await expect(page.locator(`.note-item:has-text("${uniqueText}")`)).toBeVisible({ timeout: 5000 });

    // Toggle checkbox
    const noteItem = page.locator(`.note-item:has-text("${uniqueText}")`);
    await noteItem.locator('input[type="checkbox"]').click();
    await expect(noteItem).toHaveClass(/done/, { timeout: 3000 });
  });
});
