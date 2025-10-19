import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('home page responds and renders something meaningful', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const url = page.url();
  if (/\/login$/.test(url)) {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    return;
  }

   const candidates = [
    page.getByRole('main'),
    page.getByRole('navigation'),
    page.getByRole('heading', { level: 1 }),
    page.getByText(/brightbox|sign in|get started|welcome/i),
  ];

    const found = await Promise.any(
      candidates.map(async (loc) => {
        await expect(loc).toBeVisible({ timeout: 5000 });
        return true;
      })
    ).catch(() => false);

    expect(found, 'Expected a recognizable element on the home page').toBe(true);
  });

  test('login page loads and shows the form', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();

    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /Sign In/i })).toBeEnabled();
  });

  test('signup link is present on login page', async ({ page }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: /Sign up/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/signup');
  });
});
