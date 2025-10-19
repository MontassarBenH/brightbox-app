import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const statePath = path.join(process.cwd(), 'tests/e2e/.auth/storageState.json');

test('authenticate once and save storage state', async ({ page, baseURL }) => {
  const EMAIL = process.env.E2E_TEST_EMAIL;
  const PASSWORD = process.env.E2E_TEST_PASSWORD;

  if (!EMAIL || !PASSWORD) throw new Error('Missing E2E_TEST_EMAIL or E2E_TEST_PASSWORD');

  await page.goto(`${baseURL}/login`);
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(/\/(feed|admin|profile|\/)$/);

  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await page.context().storageState({ path: statePath });
});
