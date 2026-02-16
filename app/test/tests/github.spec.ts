import { test, expect } from '@playwright/test';

test.describe('github page', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/github');
    await expect(page.locator('h1')).toContainText('GitHub');
  });

  test('tabs render', async ({ page }) => {
    await page.goto('/github');
    await expect(page.locator('.github-tabs')).toBeVisible();
    await expect(page.locator('.github-tab')).toHaveCount(3);
    await expect(page.locator('.github-tab:has-text("Review Requests")')).toBeVisible();
    await expect(page.locator('.github-tab:has-text("Open PRs")')).toBeVisible();
    await expect(page.locator('.github-tab:has-text("Search")')).toBeVisible();
  });

  test('switching tabs works', async ({ page }) => {
    await page.goto('/github');

    // Click Open PRs tab
    await page.locator('.github-tab:has-text("Open PRs")').click();
    await expect(page.locator('.github-tab:has-text("Open PRs")')).toHaveClass(/active/);

    // Click Search tab
    await page.locator('.github-tab:has-text("Search")').click();
    await expect(page.locator('.github-tab:has-text("Search")')).toHaveClass(/active/);
    await expect(page.locator('.github-search-form')).toBeVisible();
  });

  test('search form and mode toggle', async ({ page }) => {
    await page.goto('/github');
    await page.locator('.github-tab:has-text("Search")').click();

    await expect(page.locator('.github-search-input')).toBeVisible();

    // Mode toggle buttons
    await expect(page.locator('.github-search-mode .github-tab:has-text("Issues & PRs")')).toBeVisible();
    await expect(page.locator('.github-search-mode .github-tab:has-text("Code")')).toBeVisible();

    // Toggle to code mode
    await page.locator('.github-search-mode .github-tab:has-text("Code")').click();
    await expect(page.locator('.github-search-mode .github-tab:has-text("Code")')).toHaveClass(/active/);
  });

  test('search submits query', async ({ page }) => {
    await page.goto('/github');
    await page.locator('.github-tab:has-text("Search")').click();
    await page.locator('.github-search-input').fill('test');
    await page.locator('.github-search-input').press('Enter');
    // Should show either results or loading state
    await expect(
      page.locator('.github-pr-list').or(page.locator('.empty-state'))
    ).toBeVisible();
  });
});
