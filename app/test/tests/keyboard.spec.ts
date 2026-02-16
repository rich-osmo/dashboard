import { test, expect } from '@playwright/test';

test.describe('keyboard shortcuts', () => {
  test('? opens help overlay', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');

    await page.keyboard.press('Shift+/');
    await page.waitForTimeout(300);
    // Close it
    await page.keyboard.press('Escape');
  });

  test('g then d navigates to dashboard', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('h1:has-text("Notes")')).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('g');
    await page.keyboard.press('d');
    await expect(page.locator('h1:has-text("Today")')).toBeVisible({ timeout: 10000 });
  });

  test('g then n navigates to notes', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('g');
    await page.keyboard.press('n');
    await expect(page.locator('h1:has-text("Notes")')).toBeVisible({ timeout: 10000 });
  });

  test('g then t navigates to thoughts', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('h1:has-text("Notes")')).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await expect(page.locator('h1:has-text("Thoughts")')).toBeVisible({ timeout: 10000 });
  });

  test('g then p navigates to team', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('h1:has-text("Notes")')).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({ timeout: 10000 });
  });

  test('c navigates to notes with focus', async ({ page }) => {
    await page.goto('/github');
    await expect(page.locator('h1:has-text("GitHub")')).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('c');
    await page.waitForURL(/\/notes/);
  });

  test('shortcuts do not fire when input is focused', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('.note-input')).toBeVisible({ timeout: 10000 });

    await page.locator('.note-input').click();

    await page.keyboard.press('g');
    await page.keyboard.press('d');
    await page.waitForTimeout(200);

    expect(page.url()).toContain('/notes');
  });
});
