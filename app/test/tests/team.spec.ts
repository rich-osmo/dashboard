import { test, expect } from '@playwright/test';

test.describe('team page', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
  });

  test('org tree lists render', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const lists = page.locator('.org-tree-list');
    expect(await lists.count()).toBeGreaterThanOrEqual(1);
  });

  test('clicking a name navigates to employee page', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const nameLink = page.locator('.org-tree-name').first();
    if (await nameLink.isVisible()) {
      await nameLink.click();
      await page.waitForURL(/\/employees\//);
      await expect(page.locator('.breadcrumb')).toBeVisible({ timeout: 10000 });
    }
  });

  test('add person form shows and hides', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const addBtn = page.locator('button:has-text("+ add person")');
    await expect(addBtn).toBeVisible();

    await addBtn.click();
    await expect(page.locator('.add-employee-form')).toBeVisible();
    await expect(page.locator('input[placeholder="Full name"]')).toBeVisible();

    await page.locator('button:has-text("cancel")').click();
    await expect(page.locator('.add-employee-form')).not.toBeVisible();
  });

  test('Direct Reports section always exists', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Direct Reports")')).toBeVisible();
  });
});
