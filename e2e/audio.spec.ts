import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

// Service worker by zachytil manifest i zvuk dřív než test; tady se obojí podvrhuje, proto je vypnutý.
test.use({ serviceWorkers: 'block' });

const content = JSON.parse(readFileSync('src/content/generated/content.json', 'utf8')) as { lessons: { id: string; moduleId: string; title: string; order: number }[] };
const basics = content.lessons.filter((lesson) => lesson.moduleId === 'zaklady').sort((a, b) => a.order - b.order);

/** Krátký tichý WAV (0,4 s, 8 kHz, mono), který prohlížeč opravdu přehraje do konce. */
function silentWav(): Buffer {
  const samples = 3200;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + samples, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24); header.writeUInt32LE(8000, 28); header.writeUInt16LE(1, 32); header.writeUInt16LE(8, 34);
  header.write('data', 36); header.writeUInt32LE(samples, 40);
  return Buffer.concat([header, Buffer.alloc(samples, 128)]);
}

async function mockAudio(page: Page, lessonIds: string[]) {
  const files = lessonIds.map((lessonId) => ({ lessonId, file: `media/zaklady/${lessonId}.wav`, bytes: 3244, seconds: 0.4, hash: 'test' }));
  await page.route('**/media-manifest.json', (route) => route.fulfill({ json: { voice: 'Testovací hlas', generatedAt: '2026-11-12', files } }));
  await page.route('**/media/**', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() }));
}

async function acceptOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Začít' }).click();
  await expect(page.getByRole('link', { name: /Rychlý check/ })).toBeVisible();
}

test('shrnutí lekce přehraje nahraný hlas a po skončení se vrátí do klidu', async ({ page }) => {
  await mockAudio(page, [basics[0]!.id]);
  await acceptOnboarding(page);
  await page.goto(`/uceni/${basics[0]!.id}`);
  await page.getByRole('list', { name: 'Části lekce' }).getByRole('button').nth(8).click();
  await page.getByTestId('summary-play').click();
  await expect(page.getByTestId('summary-source')).toHaveText('Nahraný hlas');
  await expect(page.getByTestId('summary-play')).toHaveText('▶ Přehrát shrnutí');
});

test('režim poslechu: přehrává souvisle, přejde na další lekci a ukazuje přepis', async ({ page }) => {
  await mockAudio(page, basics.slice(0, 2).map((lesson) => lesson.id));
  await acceptOnboarding(page);
  await page.goto('/uceni');
  await page.getByRole('link', { name: /Režim poslechu/ }).click();
  await page.getByRole('combobox').selectOption('zaklady');
  await expect(page.getByTestId('podcast-position')).toContainText(`1 / ${basics.length}`);
  await expect(page.getByTestId('podcast-title')).toHaveText(basics[0]!.title);
  await expect(page.getByTestId('podcast-transcript')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Přehrát' }).click();
  // První skladba doběhne a přehrávač sám přejde na druhou.
  await expect(page.getByTestId('podcast-title')).toHaveText(basics[1]!.title);
  await expect(page.getByTestId('podcast-position')).toContainText(`2 / ${basics.length}`);
  await page.getByRole('button', { name: '■ Stop' }).click();
  await expect(page.getByTestId('podcast-source')).toHaveText('Zastaveno');
  await page.getByRole('button', { name: 'Předchozí' }).click();
  await expect(page.getByTestId('podcast-title')).toHaveText(basics[0]!.title);
  await page.getByRole('button', { name: /Rychlost 1×/ }).click();
  await expect(page.getByRole('button', { name: /Rychlost 1,25×/ })).toBeVisible();
  // Pozice se pamatuje.
  await page.reload();
  await expect(page.getByTestId('podcast-title')).toHaveText(basics[0]!.title);
  await expect(page.getByRole('combobox')).toHaveValue('zaklady');
});

test('zvukový balíček jde stáhnout do zařízení a smazat', async ({ page }) => {
  await mockAudio(page, basics.slice(0, 3).map((lesson) => lesson.id));
  await acceptOnboarding(page);
  await page.goto('/nastaveni');
  const pack = page.getByTestId('pack-zaklady');
  await expect(pack).toContainText('nahrávek: 3');
  const cached = () => page.evaluate(async () => (await (await caches.open('media')).keys()).length);
  expect(await cached()).toBe(0);
  await pack.getByRole('button', { name: 'Stáhnout' }).click();
  await expect(pack).toContainText('v zařízení');
  expect(await cached()).toBe(3);
  await pack.getByRole('button', { name: 'Smazat' }).click();
  await expect(pack.getByRole('button', { name: 'Stáhnout' })).toBeVisible();
  expect(await cached()).toBe(0);
});

test('nepovedené stažení balíčku ohlásí chybu a nic netvrdí', async ({ page }) => {
  await page.route('**/media-manifest.json', (route) => route.fulfill({ json: { voice: 'Testovací hlas', generatedAt: '', files: [{ lessonId: basics[0]!.id, file: 'media/zaklady/a.wav', bytes: 10, seconds: 1, hash: 'x' }] } }));
  await page.route('**/media/**', (route) => route.fulfill({ status: 404, body: '' }));
  await acceptOnboarding(page);
  await page.goto('/nastaveni');
  const pack = page.getByTestId('pack-zaklady');
  await pack.getByRole('button', { name: 'Stáhnout' }).click();
  await expect(pack).toContainText('Stažení se nezdařilo');
  await expect(pack).not.toContainText('v zařízení');
});

test('bez nahraného zvuku to nastavení řekne a lekce nabídne čtení', async ({ page }) => {
  await page.route('**/media-manifest.json', (route) => route.fulfill({ json: { voice: '', generatedAt: '', files: [] } }));
  await acceptOnboarding(page);
  await page.goto('/nastaveni');
  await expect(page.getByTestId('packs-empty')).toBeVisible();
  await page.goto(`/uceni/${basics[0]!.id}`);
  await page.getByRole('list', { name: 'Části lekce' }).getByRole('button').nth(8).click();
  await expect(page.getByTestId('summary-play')).toBeVisible();
});

test('animovaný výklad: bez nahraného hlasu běží s titulky, jde krokovat a přehrát', async ({ page }) => {
  await page.route('**/media-manifest.json', (route) => route.fulfill({ json: { voice: '', generatedAt: '', files: [], animations: [] } }));
  await acceptOnboarding(page);
  await page.goto('/uceni');
  await page.getByRole('link', { name: /Animované výklady/ }).click();
  await page.getByRole('link', { name: /Tlak a objem plynu/ }).click();
  const animation = page.getByTestId('animation');
  await expect(animation).toHaveAttribute('data-cue', '0');
  await expect(page.getByTestId('animation-caption')).toContainText('Na hladině tlačí na balonek jeden bar');
  await page.getByRole('button', { name: 'Další věta' }).click();
  await expect(animation).toHaveAttribute('data-cue', '1');
  await expect(page.getByTestId('animation-caption')).toContainText('V deseti metrech');
  await page.getByTestId('animation-toggle').click();
  await expect(page.getByText(/bez hlasu, čti titulky/)).toBeVisible();
  // Scéna se hýbe: balonek klesá a objem v odečtu se mění.
  await expect(animation.getByText('5,0 l')).toBeVisible({ timeout: 8000 });
  await expect(animation).toHaveAttribute('data-cue', '2', { timeout: 15_000 });
  await page.getByTestId('animation-toggle').click();
  await page.getByRole('button', { name: 'Předchozí věta' }).click();
  await expect(animation).toHaveAttribute('data-cue', /[12]/);
});

test('animovaný výklad se řídí nahraným hlasem a je vložený v lekci', async ({ page }) => {
  const files = [{ id: 'tlak-a-objem', moduleId: 'zaklady', file: 'media/animace/tlak-a-objem.wav', bytes: 3244, seconds: 0.4, hash: 't', cues: [0, 0.05, 0.1, 0.15, 0.2, 0.3] }];
  await page.route('**/media-manifest.json', (route) => route.fulfill({ json: { voice: 'Testovací hlas', generatedAt: '', files: [], animations: files } }));
  await page.route('**/media/**', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() }));
  await acceptOnboarding(page);
  await page.goto('/uceni/boyle-objem');
  await page.getByRole('list', { name: 'Části lekce' }).getByRole('button').nth(1).click();
  const animation = page.getByTestId('animation');
  await animation.scrollIntoViewIfNeeded();
  await page.getByTestId('animation-toggle').click();
  // Nahrávka má 0,4 s; výklad podle ní doběhne na poslední větu.
  await expect(animation).toHaveAttribute('data-cue', '5');
  await expect(page.getByTestId('animation-caption')).toContainText('nikdy nezadržuje dech');
  await page.goto('/nastaveni');
  await expect(page.getByTestId('pack-zaklady')).toContainText('nahrávek: 1');
});

