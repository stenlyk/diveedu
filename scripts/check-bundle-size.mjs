// Hlídá velikost toho, co service worker precachuje = co se stáhne při instalaci.
// Dva rozpočty (rozhodnutí 2026-11-12):
//   kód (aplikace, styly, fonty)        < 1,5 MB  – původní limit ze SPEC
//   celkem včetně textu lekcí a obsahu  < 3 MB    – text musí být offline celý
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MB = 1024 * 1024;
const CODE_LIMIT = 1.5 * MB;
const TOTAL_LIMIT = 3 * MB;

const sw = readFileSync('dist/sw.js', 'utf8');
const urls = [...new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]))];
if (urls.length === 0) {
  console.error('✗ v dist/sw.js nenalezen precache manifest');
  process.exit(1);
}
const sizes = urls.map((url) => [url, statSync(join('dist', url)).size]);
const total = sizes.reduce((sum, [, size]) => sum + size, 0);
// Text: zkompilované lekce (chunky lesson-*.js) a data obsahu přibalená do aplikace.
const lessons = sizes.filter(([url]) => /assets\/lesson-[^/]+\.js$/.test(url)).reduce((sum, [, size]) => sum + size, 0);
const contentJson = statSync('src/content/generated/content.json').size;
const content = lessons + contentJson;
const code = total - content;

sizes.sort((a, b) => b[1] - a[1]);
for (const [url, size] of sizes.slice(0, 6)) console.log(`  ${(size / 1024).toFixed(0).padStart(5)} kB  ${url}`);
const fmt = (bytes) => (bytes / MB).toFixed(2);
console.log(`  kód ${fmt(code)} MB (limit 1,5) · text a obsah ${fmt(content)} MB · celkem ${fmt(total)} MB (limit 3) · ${urls.length} souborů`);
if (code > CODE_LIMIT || total > TOTAL_LIMIT) {
  console.error('✗ překročen rozpočet velikosti');
  process.exit(1);
}
console.log('✓ velikost v rozpočtu');
