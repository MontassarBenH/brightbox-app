// tests/e2e/profile.auth.spec.ts
import { test, expect } from '@playwright/test';

const TEST_USER_ID = process.env.E2E_TEST_USER_ID!;

test.use({ storageState: 'tests/e2e/.auth/storageState.json' });

test.describe('Profile (auth)', () => {
  test('shows profile content when logged in (happy-path smoke)', async ({ page }) => {
    await page.goto(`/profile/${TEST_USER_ID}`);
    await expect(page.getByRole('heading', { name: /^videos$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /^posts$/i })).toBeVisible({ timeout: 10_000 });
  });

  // ✅ Replace the bad test with a tiny, relevant one
  test('profile tabs/sections render and are reachable', async ({ page }) => {
    await page.goto(`/profile/${TEST_USER_ID}`);

    // If you actually use tabs, click them; otherwise, just assert both sections exist
    const videosTab = page.getByRole('tab', { name: /videos/i });
    const postsTab  = page.getByRole('tab', { name: /posts/i });

    if (await videosTab.count()) {
      await videosTab.click();
      await expect(page.getByRole('heading', { name: /^videos$/i })).toBeVisible();
    }
    if (await postsTab.count()) {
      await postsTab.click();
      await expect(page.getByRole('heading', { name: /^posts$/i })).toBeVisible();
    }

    // Fallback if not using tabs: both section headings should be visible anyway.
    if (!(await videosTab.count()) && !(await postsTab.count())) {
      await expect(page.getByRole('heading', { name: /^videos$/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /^posts$/i })).toBeVisible();
    }
  });
});
