import { test, expect } from '@playwright/test';

test.describe('employee page', () => {
  test('navigate from team page to employee', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const nameLink = page.locator('.org-tree-name').first();

    if (await nameLink.isVisible()) {
      const name = await nameLink.textContent();
      await nameLink.click();
      await page.waitForURL(/\/employees\//);
      await expect(page.locator('.breadcrumb')).toBeVisible({ timeout: 10000 });
    }
  });

  test('tab bar renders with correct tabs', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const nameLink = page.locator('.org-tree-name').first();
    if (!(await nameLink.isVisible())) return;

    await nameLink.click();
    await page.waitForURL(/\/employees\//);
    await expect(page.locator('.tab-bar')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.tab:has-text("Overview")')).toBeVisible();
    await expect(page.locator('.tab:has-text("Direct Reports")')).toBeVisible();
    await expect(page.locator('.tab:has-text("1:1 Notes")')).toBeVisible();
  });

  test('switching tabs works', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const nameLink = page.locator('.org-tree-name').first();
    if (!(await nameLink.isVisible())) return;

    await nameLink.click();
    await expect(page.locator('.tab-bar')).toBeVisible({ timeout: 10000 });

    await page.locator('.tab:has-text("Direct Reports")').click();
    await expect(page.locator('.tab:has-text("Direct Reports")')).toHaveClass(/active/);

    await page.locator('.tab:has-text("1:1 Notes")').click();
    await expect(page.locator('.tab:has-text("1:1 Notes")')).toHaveClass(/active/);

    await page.locator('.tab:has-text("Overview")').click();
    await expect(page.locator('.tab:has-text("Overview")')).toHaveClass(/active/);
  });

  test('overview tab shows dashboard cards', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const nameLink = page.locator('.org-tree-name').first();
    if (!(await nameLink.isVisible())) return;

    await nameLink.click();
    await expect(page.locator('.employee-dashboard')).toBeVisible({ timeout: 10000 });
    expect(await page.locator('.emp-card').count()).toBeGreaterThanOrEqual(1);
  });

  test('breadcrumb has Team link', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const nameLink = page.locator('.org-tree-name').first();
    if (!(await nameLink.isVisible())) return;

    await nameLink.click();
    await expect(page.locator('.breadcrumb')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.breadcrumb a:has-text("Team")')).toBeVisible();
    await page.locator('.breadcrumb a:has-text("Team")').click();
    await page.waitForURL(/\/team/);
  });

  test('edit button shows edit form', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const nameLink = page.locator('.org-tree-name').first();
    if (!(await nameLink.isVisible())) return;

    await nameLink.click();
    await expect(page.locator('.tab-bar')).toBeVisible({ timeout: 10000 });

    await page.locator('.btn-link:has-text("edit")').click();
    await expect(page.locator('.employee-edit-form')).toBeVisible();

    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('.employee-edit-form')).not.toBeVisible();
  });

  test('add 1:1 topic on overview tab', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
    const nameLink = page.locator('.org-tree-name').first();
    if (!(await nameLink.isVisible())) return;

    await nameLink.click();
    await expect(page.locator('.employee-dashboard')).toBeVisible({ timeout: 10000 });

    const topicInput = page.locator('input[placeholder="Add a topic for next 1:1..."]');
    if (await topicInput.isVisible()) {
      const uniqueText = `1:1 topic ${Date.now()}`;
      await topicInput.fill(uniqueText);
      await topicInput.press('Enter');
      await expect(page.locator(`.note-item:has-text("${uniqueText}")`)).toBeVisible({ timeout: 10000 });
    }
  });
});
