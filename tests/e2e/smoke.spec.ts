import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('home page responds and renders something meaningful', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    if (/\/login$/.test(page.url())) {
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
      return;
    }

    // Give the app a moment to hydrate/settle.
    await page.waitForSelector('body', { state: 'visible' });

    await expect
      .poll(async () => {
        const checks = await Promise.all([
          page.getByRole('main').isVisible().catch(() => false),
          page.getByRole('navigation').isVisible().catch(() => false),
          page.getByRole('heading', { level: 1 }).isVisible().catch(() => false),
          page.locator('text=/brightbox|sign in|get started|welcome/i').first().isVisible().catch(() => false),
        ]);
        return checks.some(Boolean);
      }, { timeout: 15000, message: 'Expected a recognizable element on the home page' })
      .toBe(true);
  });

  test('login page loads and shows the form', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });

  test('signup link is present on login page', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const link = page.getByRole('link', { name: /sign up/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/signup');
  });
});
