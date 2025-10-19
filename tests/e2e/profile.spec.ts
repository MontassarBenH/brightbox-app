import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL!;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD!;
const TEST_USER_ID = process.env.E2E_TEST_USER_ID!;

test.describe('Profile', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto(`/profile/${TEST_USER_ID}`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows profile content when logged in (happy-path smoke)', async ({ page }) => {
    // 1) Sign in via the real login form
    await page.goto('/login');

    await page.getByLabel(/Email/i).fill(TEST_EMAIL);
    await page.getByLabel(/Password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /Sign In/i }).click();

    // You may redirect to /feed or elsewhere—wait for a known post-login element
    await page.waitForURL(/\/(feed|admin|profile|\/)$/);

    // 2) Go to the known profile id
    await page.goto(`/profile/${TEST_USER_ID}`);

    // 3) Assert headings (use exact matches to avoid collisions)
    await expect(page.getByRole('heading', { name: /^videos$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^posts$/i })).toBeVisible();
  });
});
