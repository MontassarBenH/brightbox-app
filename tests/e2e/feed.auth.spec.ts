import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/storageState.json' });

test.describe('Feed (auth)', () => {
  test('renders chrome and either empty-state or content', async ({ page }) => {
  await page.goto('/feed');
  await page.waitForLoadState('networkidle');
  
  // Wait for either content or empty state
  await page.waitForFunction(() => {
    const loading = document.querySelector('.animate-pulse');
    const hasContent = document.querySelector('[data-feed-id]');
    const isEmpty = document.querySelector('[data-testid="empty-feed"]');
    return !loading && (hasContent || isEmpty);
  }, { timeout: 10000 });

  const anyItemSection = page.locator('[data-feed-id]');
  const count = await anyItemSection.count();
  
  if (count > 0) {
    await expect(anyItemSection.first()).toBeVisible();
  } else {
    const emptyState = page.getByTestId('empty-feed');
    await expect(emptyState).toBeVisible();
    
    // FAB visible in empty state
    const fabGroup = page.getByTestId('fab-group');
    await expect(fabGroup).toBeVisible();
  }
});

 test('subjects strip is interactive at a basic level', async ({ page }) => {
  await page.goto('/feed?test-mode=true');
  await page.waitForLoadState('networkidle');
  
  // Wait for loading to finish
  await page.waitForFunction(() => {
    const loading = document.querySelector('.animate-pulse');
    return !loading;
  }, { timeout: 10000 });

  // Scroll to top to ensure header is visible
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300); 

  const subjectsAll = page.getByTestId('subjects-all');
  await expect(subjectsAll).toBeVisible();
  
  // Force click 
  await subjectsAll.click({ force: true });
  
  await page.waitForTimeout(500);
  
  const item = page.locator('[data-feed-id]').first();
  const empty = page.getByTestId('empty-feed');
  
  const itemCount = await item.count();
  
  if (itemCount > 0) {
    await expect(item).toBeVisible({ timeout: 3_000 });
  } else {
    await expect(empty).toBeVisible({ timeout: 3_000 });
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
