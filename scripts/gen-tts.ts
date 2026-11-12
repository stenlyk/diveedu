/**
 * Vygeneruje zvuková shrnutí lekcí do public/media/<modul>/<lekce>.m4a a manifest public/media-manifest.json.
 *
 * Hlas: systémový český hlas macOS (příkaz `say`), převod do AAC nástrojem `afconvert`. Nic se neposílá mimo počítač.
 * Čtený text prochází slovníkem výslovnosti (src/audio/pronounce.ts). Soubory, jejichž text se nezměnil, se přeskakují.
 *
 *   npm run tts            vygeneruje chybějící a změněné
 *   npm run tts -- --all   přegeneruje všechno
 *
 * Výstup není v gitu: je to odvozený binární obsah. Před nasazením spusť `npm run tts` a pak `npm run build`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type AudioFile, type AudioManifest, parseManifest } from '../src/audio/manifest';
import { lessonSpeech } from '../src/audio/pronounce';
import type { Content } from '../src/content/schema';

const VOICE = process.env.TTS_VOICE ?? 'Zuzana';
/** Slov za minutu; výchozí tempo hlasu je pro výklad příliš rychlé. */
const RATE = process.env.TTS_RATE ?? '165';
const BITRATE = '32000';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'public/media-manifest.json');
const content = JSON.parse(readFileSync(join(root, 'src/content/generated/content.json'), 'utf8')) as Content;
const all = process.argv.includes('--all');

function requireTool(tool: string): void {
  try {
    execFileSync('which', [tool], { stdio: 'ignore' });
  } catch {
    console.error(`✗ Nástroj „${tool}“ není k dispozici. Generování zvuku běží jen na macOS s českým hlasem (${VOICE}).`);
    process.exit(1);
  }
}
for (const tool of ['say', 'afconvert', 'afinfo']) requireTool(tool);

const previous = existsSync(manifestPath) ? parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8'))) : { voice: '', generatedAt: '', files: [] };
const voiceLabel = `${VOICE} (systémový hlas macOS, ${RATE} slov/min)`;
const known = new Map(previous.voice === voiceLabel ? previous.files.map((file) => [file.lessonId, file]) : []);
const work = mkdtempSync(join(tmpdir(), 'diveedu-tts-'));
const files: AudioFile[] = [];
let generated = 0;

try {
  for (const lesson of content.lessons) {
    const text = lessonSpeech(lesson);
    const hash = createHash('sha256').update(`${voiceLabel}\n${text}`).digest('hex').slice(0, 16);
    const file = `media/${lesson.moduleId}/${lesson.id}.m4a`;
    const target = join(root, 'public', file);
    const old = known.get(lesson.id);
    if (!all && old?.hash === hash && existsSync(target)) {
      files.push(old);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    const textFile = join(work, 'in.txt');
    const aiff = join(work, 'out.aiff');
    writeFileSync(textFile, text);
    execFileSync('say', ['-v', VOICE, '-r', RATE, '-f', textFile, '-o', aiff]);
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', BITRATE, '-c', '1', aiff, target]);
    const info = execFileSync('afinfo', [target], { encoding: 'utf8' });
    const seconds = Number(/estimated duration: ([\d.]+)/.exec(info)?.[1] ?? 0);
    files.push({ lessonId: lesson.id, file, bytes: statSync(target).size, seconds: Math.round(seconds * 10) / 10, hash });
    generated += 1;
    process.stdout.write(`  ${lesson.id} · ${seconds.toFixed(0)} s\n`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const manifest: AudioManifest = { voice: voiceLabel, generatedAt: generated > 0 || !previous.generatedAt ? new Date().toISOString() : previous.generatedAt, files };
writeFileSync(manifestPath, JSON.stringify(manifest));
const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
const seconds = files.reduce((sum, file) => sum + file.seconds, 0);
console.log(`✓ Zvuk: ${files.length} lekcí, nově ${generated}; celkem ${(bytes / 1024 / 1024).toFixed(1)} MB, ${(seconds / 60).toFixed(0)} min.`);
