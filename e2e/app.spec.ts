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

test('kalkulačka MOD: režim Spočti mi počítá přes calc a ukazuje disclaimer', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/nastroje');
  await page.getByRole('link', { name: /^MOD/ }).click();
  await expect(page.getByRole('note').first()).toContainText('Neplánuj podle něj skutečný ponor');
  const mod = page.locator('[data-output="MOD (zaokrouhleno dolů)"]');
  await expect(mod).toHaveText('33 m'); // EAN32 při 1,4 bar = 33,75 m, dolů
  await expect(page.getByText('Postup')).toBeVisible();
  await page.getByRole('button', { name: 'Limit ppO2: přidat' }).click();
  await page.getByRole('button', { name: 'Limit ppO2: přidat' }).click();
  await expect(mod).toHaveText('40 m');
});

test('kalkulačka MOD: režim Spočítám sám dá zpětnou vazbu u chybného kroku', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/nastroje/mod');
  await page.getByRole('tab', { name: 'Spočítám sám' }).click();
  await page.locator('#practice-0').fill('999');
  await page.locator('#practice-1').fill('999');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByText('Tady se postup rozchází.')).toHaveCount(1);
  await page.getByRole('button', { name: 'Nové zadání' }).click();
  await expect(page.locator('#practice-0')).toHaveValue('');
});

test('tkáňový simulátor: rozvrh, přehrávání a reakce na gradient factors', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/nastroje');
  await page.getByRole('link', { name: /Tkáňový simulátor/ }).click();
  const sim = page.getByTestId('tissue-sim');
  await expect(sim.getByRole('note')).toContainText('není plánovač ponorů');
  await expect(page.getByTestId('sim-stops')).toContainText('Zastávky:');
  const ascent = async () => Number((await page.getByTestId('sim-ascent').innerText()).replace(/\D/g, ''));
  const before = await ascent();
  // Konzervativnější GF high (85 → 70) musí dekompresi prodloužit.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'GF high: ubrat' }).click();
  expect(await ascent()).toBeGreaterThan(before);
  await expect(page.getByTestId('sim-now')).toContainText('0. minuta');
  await page.getByRole('slider', { name: 'Čas ponoru' }).fill('20');
  await expect(page.getByTestId('sim-now')).not.toContainText(/^0\. minuta/);
  await expect(page.getByTestId('sim-now')).toContainText('strop');
  // Mělký krátký ponor nemá zastávky.
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Hloubka: ubrat' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Čas na dně: ubrat' }).click();
  await expect(page.getByTestId('sim-stops')).toHaveText('Bez zastávek.');
});

test('kalkulačka minimum gas počítá rezervu a rozepíše postup', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/nastroje/rock-bottom');
  await expect(page.locator('[data-output="Rezerva v litrech"]')).toHaveText('493 l');
  await expect(page.locator('[data-output="Rezerva na manometru (nahoru na 10 bar)"]')).toHaveText('30 bar');
  await expect(page.getByText('Pro dva potápěče')).toBeVisible();
  await expect(page.locator('.katex-error')).toHaveCount(0);
});

test('případová studie má všech osm částí, označení jistoty a výpočet', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/uceni');
  await page.getByRole('link', { name: /Případové studie/ }).click();
  await page.getByRole('link', { name: /Kyslíkové křeče po přepnutí/ }).click();
  await expect(page.getByText('Příčina: hypotéza')).toBeVisible();
  await expect(page.getByText('čeká na odbornou kontrolu')).toBeVisible();
  for (const heading of ['1. Kontext', '2. Profil', '3. Časová osa', '4. Řetěz chyb', '5. Fyziologický mechanismus', '6. Spočítej si to', '7. Co by řetěz přerušilo', '8. Zdroje']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  const task = page.locator('form').filter({ hasText: 'Jaké je ppO2 při dýchání EAN50 ve 40 m?' });
  await task.getByRole('textbox').fill('2,5');
  await task.getByRole('button', { name: 'Ověřit' }).click();
  await expect(task.getByText('✓ Správně.')).toBeVisible();
});

test('všechny lekce se vykreslí ve všech devíti částech bez chyby', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await acceptOnboarding(page);
  await page.goto('/uceni');
  await expect(page.getByRole('link', { name: /Tlak a hloubka/ })).toBeVisible();
  const hrefs = await page.locator('a[href^="/uceni/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
  expect(hrefs.length).toBe(36);
  for (const href of hrefs) {
    await page.goto(href);
    for (let part = 1; part <= 9; part++) {
      await page.getByRole('list', { name: 'Části lekce' }).getByRole('button').nth(part - 1).click();
      await expect(page.locator('section[data-section]')).toBeVisible();
      await expect(page.locator('section[data-section]')).not.toBeEmpty();
      // KaTeX při chybě vzorce nevyhodí výjimku, jen vykreslí zdroj červeně.
      await expect(page.locator('.katex-error')).toHaveCount(0);
    }
    // Poslední část obsahuje zdroje lekce.
    await expect(page.getByRole('heading', { name: 'Zdroje' })).toBeVisible();
  }
  expect(errors).toEqual([]);
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

test('denní opakování: otevřená lekce odemkne karty a odpověď kartu naplánuje', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/trenink/opakovani');
  await expect(page.getByText('Dnes není co opakovat.')).toBeVisible();
  await page.goto('/uceni/tlak-a-hloubka');
  await expect(page.getByText('1 / 9 · Háček')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Denní opakování · 5' })).toBeVisible();
  await page.getByRole('link', { name: 'Denní opakování · 5' }).click();
  await expect(page.getByText('Otázka 1 z 5')).toBeVisible();
  // Naplánovaná karta z fronty zmizí: po jedné odpovědi čekají už jen čtyři.
  const numeric = page.getByRole('textbox', { name: /Odpověď/ });
  if (await numeric.isVisible()) {
    await numeric.fill('999');
    await page.getByRole('button', { name: 'Ověřit' }).click();
  } else {
    await page.locator('button[aria-pressed]').first().click();
  }
  await page.getByRole('button', { name: 'Další' }).click();
  // Navigace uvnitř aplikace (bez načtení stránky), aby zápis do IndexedDB stihl doběhnout.
  await page.getByRole('navigation', { name: 'Hlavní navigace' }).filter({ visible: true }).getByRole('link', { name: 'Domů' }).click();
  await expect(page.getByRole('link', { name: 'Denní opakování · 4' })).toBeVisible();
  await page.getByRole('link', { name: /Celý přehled zvládnutí/ }).click();
  await expect(page.getByTestId('streak')).toHaveText('1');
});

test('zkouška modulu: bez nápovědy, s časovým limitem a vyhodnocením proti prahu', async ({ page }) => {
  await page.clock.install();
  await acceptOnboarding(page);
  await page.goto('/trenink/zkouska/zaklady');
  await expect(page.getByText('ke splnění je potřeba 80 %')).toBeVisible();
  await page.getByRole('button', { name: 'Začít zkoušku' }).click();
  await expect(page.getByText('Otázka 1 z 40')).toBeVisible();
  await expect(page.getByTestId('quiz-clock')).toHaveText(/^4[45]:\d\d$/);
  // Čas vyprší: nezodpovězené otázky se počítají jako špatně.
  await page.clock.fastForward('46:00');
  await expect(page.getByTestId('exam-score')).toHaveText('0 %');
  await expect(page.getByText(/Nesplněno – potřeba 80 %/)).toBeVisible();
  await expect(page.getByText(/40 nezodpovězeno/)).toBeVisible();
  await page.goto('/prehled');
  await expect(page.getByText('Poslední zkoušky')).toBeVisible();
});

test('z hlavy na čas: deset úloh přes vlastní klávesnici, výsledek a tipy', async ({ page }, testInfo) => {
  await acceptOnboarding(page);
  await page.goto('/trenink/z-hlavy');
  await page.getByRole('button', { name: 'Začít' }).click();
  await expect(page.getByTestId('mental-prompt')).toBeVisible();
  // První úlohu zadej klepáním na vlastní klávesnici (mobil), další klávesnicí.
  await page.getByRole('button', { name: '9', exact: true }).click();
  await page.getByRole('button', { name: 'Desetinná čárka' }).click();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await expect(page.getByTestId('mental-input')).toContainText('9,5');
  if (testInfo.project.name === 'mobil') {
    const box = await page.getByRole('button', { name: '5', exact: true }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
  }
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText(/přesně/)).toBeVisible();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Enter'); // další úloha
    await page.keyboard.press('7');
    await page.keyboard.press('Enter'); // potvrdit
    await expect(page.getByText(/přesně/)).toBeVisible();
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('mental-score')).toHaveText(/\d+ \/ 10/);
  await page.getByText('Tipy na odhady a zaokrouhlování').click();
  await expect(page.getByText('Hloubku vyděl deseti a přičti jedna.')).toBeVisible();
});

test('mapa grafu: všechny pojmy, výběr, filtr modulu a řetěz příčin z případové studie', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/graf');
  const map = page.getByTestId('graph-map');
  await expect(map.locator('[data-node]')).toHaveCount(77);
  await map.locator('[data-node="ppo2"]').click();
  await expect(page.getByTestId('graph-selected')).toHaveText('ppO2');
  await page.getByRole('button', { name: 'Přiblížit' }).click();
  await expect(map.locator('g').first()).toHaveAttribute('transform', /scale\(1\.5\)/);
  await page.getByRole('button', { name: 'Advanced Nitrox' }).click();
  await expect(map.locator('[data-node]')).toHaveCount(21);
  await page.getByRole('tab', { name: 'Seznam' }).click();
  await expect(page.getByRole('link', { name: /Absolutní tlak/ })).toBeVisible();

  await page.goto('/pripady/zamena-plynu-krece');
  await page.getByRole('link', { name: 'Zobrazit řetěz v mapě grafu' }).click();
  await expect(page.getByText(/Zvýrazněný řetěz příčin/)).toBeVisible();
  await expect(page.getByTestId('graph-map').locator('[data-node="zamena-plynu"]')).toHaveAttribute('opacity', '1');
  await expect(page.getByTestId('graph-map').locator('[data-node="hloubka"]')).toHaveAttribute('opacity', '0.25');
});

test('trénink tématu a slabiny nabídnou otázky', async ({ page }) => {
  await acceptOnboarding(page);
  await page.goto('/trenink/tema?pojem=vzorec-mod');
  await expect(page.getByRole('heading', { name: 'Trénink: Vzorec MOD' })).toBeVisible();
  await expect(page.getByText(/Otázka 1 z \d+/)).toBeVisible();
  await page.goto('/trenink/slabiny');
  await expect(page.getByText('Nejslabší pojmy:')).toBeVisible();
  await expect(page.getByText('Otázka 1 z 10')).toBeVisible();
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
  await page.goto('/nastroje/mod');
  await expect(page.locator('[data-output="MOD (zaokrouhleno dolů)"]')).toHaveText('33 m');
  await page.goto('/pripady/blue-hole-2000');
  await expect(page.getByRole('heading', { name: '4. Řetěz chyb' })).toBeVisible();
  await page.goto('/uceni/kyslikove-okno');
  await page.getByRole('button', { name: '5. Vyzkoušej si' }).click();
  await expect(page.getByText(/kyslíkové okno: přibližně/)).toBeVisible();
  await page.goto('/nastroje/simulator/tkane');
  await expect(page.getByTestId('sim-stops')).toContainText('Zastávky:');
  await page.goto('/uceni/gradient-factors');
  await page.getByRole('button', { name: '4. Ukázkový výpočet' }).click();
  await expect(page.locator('[data-worked="ceilingDepthN2"]').first()).toContainText('9,3 m');
  await page.goto('/trenink/rychly-check');
  await expect(page.getByText('Otázka 1 z 10')).toBeVisible();
  await page.goto('/trenink/z-hlavy');
  await page.getByRole('button', { name: 'Začít' }).click();
  await expect(page.getByTestId('mental-prompt')).toBeVisible();
  await page.goto('/graf');
  await expect(page.getByTestId('graph-map').locator('[data-node]')).toHaveCount(77);
  await page.goto('/prehled');
  await expect(page.getByText('Zvládnutí pojmů')).toBeVisible();
  await page.goto('/graf/absolutni-tlak');
  await expect(page.getByTestId('local-graph')).toBeVisible();
});
