import { test, expect } from '@playwright/test';

test.describe('sidebar navigation', () => {
  test('sidebar is visible with nav links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.sidebar')).toBeVisible();
    for (const label of ['Overview', 'Notes', 'Thoughts', 'Issues', 'Meetings', 'News', 'Team', 'GitHub', 'Settings']) {
      await expect(page.locator(`.sidebar nav a:has-text("${label}")`)).toBeVisible();
    }
  });

  test('navigate to each page via sidebar', async ({ page }) => {
    const routes = [
      { text: 'Notes', marker: '.note-input' },
      { text: 'Thoughts', marker: 'h1:has-text("Thoughts")' },
      { text: 'Issues', marker: 'h1:has-text("Issues")' },
      { text: 'Meetings', marker: 'h1:has-text("Meetings")' },
      { text: 'News', marker: 'h1:has-text("News")' },
      { text: 'Team', marker: 'h1:has-text("Team")' },
      { text: 'GitHub', marker: 'h1:has-text("GitHub")' },
      { text: 'Settings', marker: 'h1:has-text("Settings")' },
      { text: 'Overview', marker: '.dashboard-grid' },
    ];

    await page.goto('/');
    await page.waitForSelector('.sidebar');
    for (const { text, marker } of routes) {
      await page.locator(`.sidebar nav a:has-text("${text}")`).first().click();
      await expect(page.locator(marker)).toBeVisible({ timeout: 10000 });
    }
  });

  test('sidebar shows team members', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    await expect(page.locator('.sidebar-section-label').first()).toBeVisible();
  });

  test('clicking employee in sidebar navigates to employee page', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    const personLink = page.locator('.sidebar-person a').first();
    if (await personLink.isVisible()) {
      await personLink.click();
      await page.waitForURL(/\/employees\//);
      await expect(page.locator('.breadcrumb')).toBeVisible({ timeout: 10000 });
    }
  });

  test('sync button exists and triggers sync', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    const syncBtn = page.locator('.sidebar .sync-button').first();
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();
    await expect(syncBtn).toContainText(/Sync/);
  });

  test('settings link in sidebar bottom', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
    const settingsLink = page.locator('.sidebar-settings-btn');
    await expect(settingsLink).toBeVisible();
    await expect(settingsLink).toContainText('Connections');
    await settingsLink.click();
    await page.waitForURL('/settings');
  });
});
