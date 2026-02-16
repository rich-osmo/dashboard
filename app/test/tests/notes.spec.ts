import { test, expect } from '@playwright/test';

test.describe('notes page', () => {
  test('page loads with heading and input', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('h1:has-text("Notes")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.note-input')).toBeVisible();
  });

  test('filter buttons render and toggle', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('.note-input')).toBeVisible({ timeout: 10000 });
    const filters = page.locator('.filter-btn');
    expect(await filters.count()).toBe(3);

    await expect(page.locator('.filter-btn.active')).toContainText('open');

    await page.locator('.filter-btn:has-text("done")').click();
    await expect(page.locator('.filter-btn:has-text("done")')).toHaveClass(/active/);

    await page.locator('.filter-btn:has-text("all")').click();
    await expect(page.locator('.filter-btn:has-text("all")')).toHaveClass(/active/);

    await page.locator('.filter-btn:has-text("open")').click();
    await expect(page.locator('.filter-btn:has-text("open")')).toHaveClass(/active/);
  });

  test('create a note', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('.note-input')).toBeVisible({ timeout: 10000 });
    const uniqueText = `Test note ${Date.now()}`;

    await page.locator('.note-input').fill(uniqueText);
    await page.locator('.note-input').press('Enter');

    await expect(page.locator(`.note-item:has-text("${uniqueText}")`)).toBeVisible({ timeout: 10000 });
  });

  test('toggle note status via checkbox', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('.note-input')).toBeVisible({ timeout: 10000 });

    const uniqueText = `Toggle test ${Date.now()}`;
    await page.locator('.note-input').fill(uniqueText);
    await page.locator('.note-input').press('Enter');
    await expect(page.locator(`.note-item:has-text("${uniqueText}")`)).toBeVisible({ timeout: 10000 });

    const noteItem = page.locator(`.note-item:has-text("${uniqueText}")`);
    await noteItem.locator('input[type="checkbox"]').click();
    await expect(noteItem).toHaveClass(/done/, { timeout: 5000 });
  });

  test('delete a note', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('.note-input')).toBeVisible({ timeout: 10000 });

    const uniqueText = `Delete test ${Date.now()}`;
    await page.locator('.note-input').fill(uniqueText);
    await page.locator('.note-input').press('Enter');
    await expect(page.locator(`.note-item:has-text("${uniqueText}")`)).toBeVisible({ timeout: 10000 });

    const noteItem = page.locator(`.note-item:has-text("${uniqueText}")`);
    await noteItem.locator('button:has-text("×")').click();

    await expect(page.locator(`.note-item:has-text("${uniqueText}")`)).not.toBeVisible({ timeout: 5000 });
  });

  test('All Notes section heading exists', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('h2:has-text("All Notes")')).toBeVisible({ timeout: 10000 });
  });
});
