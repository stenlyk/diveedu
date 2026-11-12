import { expect, type Page, test } from '@playwright/test';

async function acceptOnboarding(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Než začneš' })).toBeVisible();
  const start = page.getByRole('button', { name: 'Začít' });
  await expect(start).toBeDisabled();
  await page.getByRole('checkbox').check();
  await start.click();
  await expect(page.getByRole('link', { name: /Rychlý check/ })).toBeVisible();
}

test('onboarding vyžaduje potvrzení disclaimeru a pamatuje si ho', async ({ page }) => {
  await acceptOnboarding(page);
  await page.reload();
  await expect(page.getByRole('link', { name: /Rychlý check/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Než začneš' })).toHaveCount(0);
});

test('rozložení: mobil má spodní navigaci, desktop boční panel', async ({ page }, testInfo) => {
  await acceptOnboarding(page);
  const bottom = page.getByTestId('bottom-nav');
  const side = page.getByTestId('side-nav');
  if (testInfo.project.name === 'mobil') {
    await expect(bottom).toBeVisible();
    await expect(side).toBeHidden();
    // Dotykové plochy navigace mají alespoň 48 px.
    const box = await bottom.getByRole('link', { name: 'Učení' }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    // Žádný vodorovný scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } else {
    await expect(side).toBeVisible();
    await expect(bottom).toBeHidden();
  }
});

test('rychlý check je dostupný do 2 klepnutí z úvodní obrazovky', async ({ page }) => {
  await acceptOnboarding(page);
  await page.getByRole('link', { name: /Rychlý check/ }).click(); // klepnutí 1
  await expect(page.getByText('Otázka 1 z 10')).toBeVisible();
});

test('lekce má 9 částí, čísla z calc a ověřovací otázky', async ({ page }) => {
  await acceptOnboarding(page);
  await page.getByRole('navigation', { name: 'Hlavní navigace' }).filter({ visible: true }).getByRole('link', { name: 'Učení' }).click();
  await page.getByRole('link', { name: /Tlak a hloubka/ }).click();
  await expect(page.getByRole('heading', { name: 'Tlak a hloubka' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Části lekce' }).getByRole('button')).toHaveCount(9);
  await expect(page.getByText('1 / 9 · Háček')).toBeVisible();

  await page.getByRole('button', { name: /^Dál/ }).click();
  await expect(page.locator('[data-calc="pressureRatio"]')).toHaveText('1,25');
  await page.getByRole('button', { name: /^Dál/ }).click();
  await expect(page.locator('.katex').first()).toBeVisible();
  await page.getByRole('button', { name: /^Dál/ }).click();
  await expect(page.locator('[data-worked="absPressure"]')).toContainText('4,0 bar');

  await page.getByRole('button', { name: /^Dál/ }).click();
  await expect(page.getByTestId('toy-pressure')).toHaveText('2,0 bar');
  await page.getByRole('button', { name: 'Hloubka: přidat' }).click();
  await expect(page.getByTestId('toy-pressure')).toHaveText('2,1 bar');

  await page.getByRole('button', { name: /^Dál/ }).click();
  await expect(page.getByTestId('local-graph')).toContainText('Absolutní tlak');
  await page.getByRole('button', { name: /^Dál/ }).click();
  await expect(page.getByText('čeká na odbornou kontrolu')).toBeVisible();
  await page.getByRole('button', { name: /^Dál/ }).click();
  await expect(page.getByText('Otázka 1 z 5')).toBeVisible();
  await page.getByRole('button', { name: /^Dál/ }).click();
  await expect(page.getByText('9 / 9 · Shrnutí')).toBeVisible();
  await page.getByRole('link', { name: 'Dokončit lekci' }).click();
  await expect(page.getByLabel('dokončeno')).toBeVisible();
});

test('kalkulačka MOD počítá přes calc a ukazuje disclaimer', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/nastroje');
  await expect(page.getByRole('note')).toContainText('Neplánuj podle něj skutečný ponor');
  await expect(page.getByTestId('tool-mod')).toHaveText('33 m'); // EAN32 při 1,4 bar = 33,75 m, dolů
  await expect(page.getByTestId('tool-ppo2')).toHaveText('1,28 bar');
  await page.getByRole('button', { name: '1,6 bar' }).click();
  await expect(page.getByTestId('tool-mod')).toHaveText('40 m');
});

test('numerická otázka: špatná odpověď vede zpět k principu', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/uceni/tlak-a-hloubka');
  await page.getByRole('button', { name: '8. Ověření' }).click();
  for (let i = 0; i < 5; i++) {
    const numeric = page.getByRole('textbox', { name: /Odpověď/ });
    if (await numeric.isVisible()) {
      await numeric.fill('999');
      await page.getByRole('button', { name: 'Ověřit' }).click();
      await expect(page.getByText('✗ Špatně')).toBeVisible();
      await expect(page.getByText(/Správný výsledek/)).toBeVisible();
      await expect(page.getByRole('link', { name: /Zpět k principu/ })).toBeVisible();
      return;
    }
    await page.locator('button[aria-pressed]').first().click();
    await page.getByRole('button', { name: 'Další' }).click();
  }
  throw new Error('v ověření lekce nebyla numerická otázka');
});

test('export pokroku stáhne JSON zálohu', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/nastaveni');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportovat do JSON' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^diveedu-pokrok-\d{4}-\d{2}-\d{2}\.json$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(backup.app).toBe('diveedu');
  expect(backup.data.settings).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'disclaimerAccepted' })]));
});

test('po první návštěvě funguje aplikace kompletně offline', async ({ page, context }) => {
  await acceptOnboarding(page);
  // Počkej, až service worker převezme stránku a dokončí precache.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole('link', { name: /Rychlý check/ })).toBeVisible();
  await page.goto('/uceni/tlak-a-hloubka');
  await expect(page.getByRole('heading', { name: 'Tlak a hloubka' })).toBeVisible();
  await page.getByRole('button', { name: '3. Vzorec a odvození' }).click();
  await expect(page.locator('.katex').first()).toBeVisible();
  await page.goto('/nastroje');
  await expect(page.getByTestId('tool-mod')).toHaveText('33 m');
  await page.goto('/trenink/rychly-check');
  await expect(page.getByText('Otázka 1 z 10')).toBeVisible();
  await page.goto('/graf/absolutni-tlak');
  await expect(page.getByTestId('local-graph')).toBeVisible();
});
