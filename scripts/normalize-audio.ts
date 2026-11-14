/**
 * Srovná hlasitost všech nahrávek v manifestu na jednotný cíl (npm run audio:normalize).
 * Nevolá žádné API: pracuje jen s MP3 soubory v public/media pomocí ffmpeg.
 * Soubory, které už v cíli jsou, nechá beze změny, takže opakované spuštění nic nepokazí.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseManifest } from '../src/audio/manifest';
import { audioHash, LOUDNESS_TARGET, measureLoudness, normalizeLoudness } from './lib/loudness';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'public', 'media-manifest.json');
const manifest = parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
const entries = [...manifest.files, ...manifest.animations];
const dry = process.argv.includes('--dry');

console.log(`Cíl: ${LOUDNESS_TARGET.integrated} LUFS, špička nejvýš ${LOUDNESS_TARGET.truePeak} dBTP, tolerance ±${LOUDNESS_TARGET.tolerance} LU. Souborů: ${entries.length}.`);
const before: number[] = [];
const after: number[] = [];
let changed = 0;
for (const entry of entries) {
  const path = join(root, 'public', entry.file);
  if (!existsSync(path)) {
    console.warn(`  ⚠ chybí ${entry.file}`);
    continue;
  }
  if (dry) {
    const measured = measureLoudness(path);
    before.push(measured.integrated);
    after.push(measured.integrated);
    continue;
  }
  const result = normalizeLoudness(path);
  before.push(result.before.integrated);
  after.push(result.after.integrated);
  if (result.changed) {
    changed += 1;
    console.log(`  ${entry.file}: ${result.before.integrated.toFixed(1)} → ${result.after.integrated.toFixed(1)} LUFS, špička ${result.after.truePeak.toFixed(1)} dBTP`);
  }
  entry.bytes = statSync(path).size;
  entry.audio = audioHash(path);
}

const spread = (values: number[]) => (values.length ? `${Math.min(...values).toFixed(1)} až ${Math.max(...values).toFixed(1)} LUFS (rozptyl ${(Math.max(...values) - Math.min(...values)).toFixed(1)} LU)` : '–');
console.log(`Před: ${spread(before)}`);
if (dry) process.exit(0);
console.log(`Po:   ${spread(after)}`);
writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(changed ? `✓ Upraveno ${changed} z ${entries.length} souborů; manifest má nové otisky zvuku. Změněné soubory commitni.` : `✓ Všech ${entries.length} souborů je v cíli, nic se neměnilo.`);
