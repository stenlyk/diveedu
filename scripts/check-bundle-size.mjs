// Hlídá rozpočet prvního načtení jádra (SPEC: < 1,5 MB bez médií).
// Počítá vše, co service worker precachuje = co se stáhne při instalaci.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIMIT = 1.5 * 1024 * 1024;
const sw = readFileSync('dist/sw.js', 'utf8');
const urls = [...new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]))];
if (urls.length === 0) {
  console.error('✗ v dist/sw.js nenalezen precache manifest');
  process.exit(1);
}
let total = 0;
const sizes = urls.map((url) => {
  const size = statSync(join('dist', url)).size;
  total += size;
  return [url, size];
});
sizes.sort((a, b) => b[1] - a[1]);
for (const [url, size] of sizes.slice(0, 8)) console.log(`  ${(size / 1024).toFixed(0).padStart(5)} kB  ${url}`);
const mb = (total / 1024 / 1024).toFixed(2);
if (total > LIMIT) {
  console.error(`✗ jádro má ${mb} MB (${urls.length} souborů), limit je 1,5 MB`);
  process.exit(1);
}
console.log(`✓ jádro ${mb} MB v ${urls.length} souborech (limit 1,5 MB)`);
