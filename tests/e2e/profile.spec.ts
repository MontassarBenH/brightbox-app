// tests/e2e/profile.spec.ts
import { test, expect } from '@playwright/test';

const TEST_USER_ID = process.env.E2E_TEST_USER_ID!;

/** ---------- GUEST (logged-out) ---------- */
test.describe('Profile (guest)', () => {
  // Force no auth for everything in this block
  test.use({ storageState: undefined });

  test('redirects to login when unauthenticated', async ({ page }) => {
    // get the context in a type-safe way
    const ctx = page.context();
    await ctx.clearCookies();
    await page.addInitScript(() => localStorage.clear());

    await page.goto(`/profile/${TEST_USER_ID}`);

    // SPA redirects can be async — wait for URL or login form
    await Promise.race([
      page.waitForURL('**/login*', { timeout: 15000 }),
      page.waitForSelector('form >> text=/sign in/i', { timeout: 15000 }),
    ]);

    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});

/** ---------- AUTH (logged-in) ---------- */
test.describe('Profile (auth)', () => {
  test('shows profile content when logged in (happy-path smoke)', async ({ page }) => {
    await page.goto(`/profile/${TEST_USER_ID}`);
    await expect(page.getByRole('heading', { name: /^videos$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^posts$/i })).toBeVisible();
  });
});
