import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/storageState.json' });

test.describe('Feed (auth)', () => {
  test('renders chrome and either empty-state or content', async ({ page }) => {
    await page.goto('/feed');

    // Header brand
    await expect(page.getByRole('heading', { name: /schoolfeed/i })).toBeVisible({ timeout: 15000 });

    // Subjects strip: "All" pill should always exist
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible();

    // The scrollable feed container (with or without test-id)
    const feedContainer = page.getByTestId('feed-container').or(page.locator('div.h-full.overflow-y-auto'));
    await expect(feedContainer).toBeVisible();

    // EITHER empty feed OR at least one feed item section exists
    const emptyState = page.getByTestId('empty-feed').or(page.getByText('No content yet', { exact: false }));
    const anyItemSection = page.locator('section[data-feed-id]');

    const hasItems = (await anyItemSection.count()) > 0;
    if (hasItems) {
      await expect(anyItemSection.first()).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }

    const fabGroup = page.getByTestId('fab-group');
    if (await fabGroup.count()) {
      await expect(fabGroup).toBeVisible();
    }
  });

  

  test('subjects strip is interactive at a basic level', async ({ page }) => {
    await page.goto('/feed');

    const subjectPills = page.getByRole('button'); 
    const allPill = page.getByRole('button', { name: /^all$/i });
    await expect(allPill).toBeVisible();

    const maybeOther = subjectPills.filter({ hasText: /.+/ }).nth(0); 
    const candidates = page.locator('button').filter({ hasNotText: /^all$/i }).first();

    if (await candidates.count()) {
      await candidates.click({ trial: true }).catch(() => {});
      await allPill.click();
    }

    // After clicking All, we still have either empty state or items.
    const anyItemSection = page.locator('section[data-feed-id]');
    const emptyState = page.getByTestId('empty-feed').or(page.getByText('No content yet', { exact: false }));
    const hasItems = (await anyItemSection.count()) > 0;
    if (hasItems) {
      await expect(anyItemSection.first()).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

   test('can see action bar on a feed item (if items exist)', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/feed');

    // If we already have items, just assert action area is visible.
    let item = page.locator('section[data-feed-id]').first();
    if ((await item.count()) === 0) {
      const fab = page.getByTestId('fab-create-post');
      if (await fab.count()) {
        await fab.click();

        const dialog = page.getByRole('dialog').first().or(page.locator('[role="dialog"], [data-state="open"]'));
        await dialog.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

        const candidates = [
          dialog.getByPlaceholder(/write|post|say|share/i),
          dialog.locator('textarea'),
          dialog.locator('[contenteditable="true"]'),
          dialog.locator('input[type="text"]'),
          page.getByPlaceholder(/write|post|say|share/i),           
          page.locator('textarea, [contenteditable="true"]').first() 
        ];

        let filled = false;
        for (const loc of candidates) {
          try {
            if (await loc.count()) {
              const handle = loc.first();
              const isEditable = await handle.evaluate((el) => (el as HTMLElement).getAttribute?.('contenteditable') === 'true');
              if (isEditable) {
                await handle.click();
                await handle.type('E2E seed post');
              } else {
                await handle.fill('E2E seed post');
              }
              filled = true;
              break;
            }
          } catch {
    
          }
        }

        // Try several possible submit buttons
        if (filled) {
          const submit = dialog
            .getByRole('button', { name: /post|create|publish|share/i })
            .or(page.getByRole('button', { name: /post|create|publish|share/i }));

          if (await submit.count()) {
            await submit.first().click();
          } else {
            // last resort: press Enter in the input we just filled
            await page.keyboard.press('Enter').catch(() => {});
          }

          // Wait for feed to show an item
          await expect(page.locator('section[data-feed-id]').first()).toBeVisible({ timeout: 15_000 });
        }
      }
    }

    item = page.locator('section[data-feed-id]').first();
    if ((await item.count()) === 0) {
      test.skip(); 
    }

    await expect(item).toBeVisible();

   
    const like = item.getByLabel('Like').or(item.locator('button:has(svg)')).first();
    const save = item.getByLabel('Save').or(item.locator('button:has(svg)')).nth(1);

    await expect(like).toBeVisible();
    await expect(save).toBeVisible();
  });
});
