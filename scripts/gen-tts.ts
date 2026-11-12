/**
 * Vygeneruje zvuková shrnutí lekcí do public/media/<modul>/<lekce>.<přípona> a manifest public/media-manifest.json.
 *
 * Dva zdroje hlasu:
 *   ElevenLabs – použije se, když je nastaven ELEVENLABS_API_KEY a ELEVENLABS_VOICE_ID. Texty shrnutí odcházejí službě.
 *   macOS      – systémový hlas (příkaz `say`), nic neopouští počítač. Výchozí, když klíč není.
 *
 * Nastavení se čte z proměnných prostředí nebo ze souboru .env.tts v kořeni projektu (není v gitu):
 *   ELEVENLABS_API_KEY=...
 *   ELEVENLABS_VOICE_ID=...
 *   ELEVENLABS_MODEL=eleven_multilingual_v2     (nepovinné)
 *   ELEVENLABS_SPEED=1                          (nepovinné, 0,7–1,2)
 *
 *   npm run tts -- --dry                 jen vypíše, co by se generovalo a kolik znaků to je
 *   npm run tts -- --only <id-lekce>     jedna lekce na zkoušku (lze opakovat)
 *   npm run tts                          chybějící a změněné
 *   npm run tts -- --all                 všechno znovu
 *
 * Čtený text prochází slovníkem výslovnosti (src/audio/pronounce.ts). Výstup není v gitu.
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Načte .env.tts (řádky KLÍČ=hodnota); proměnné prostředí mají přednost. */
function loadEnvFile(): void {
  const path = join(root, '.env.tts');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnvFile();

interface Provider {
  label: string;
  extension: string;
  /** Vytvoří soubor a vrátí jeho délku v sekundách. */
  synthesize(text: string, target: string): Promise<number>;
}

function macProvider(): Provider {
  const voice = process.env.TTS_VOICE ?? 'Zuzana';
  const rate = process.env.TTS_RATE ?? '165';
  for (const tool of ['say', 'afconvert', 'afinfo']) {
    try {
      execFileSync('which', [tool], { stdio: 'ignore' });
    } catch {
      console.error(`✗ Nástroj „${tool}“ není k dispozici. Bez klíče ElevenLabs běží generování jen na macOS.`);
      process.exit(1);
    }
  }
  const work = mkdtempSync(join(tmpdir(), 'diveedu-tts-'));
  process.on('exit', () => rmSync(work, { recursive: true, force: true }));
  return {
    label: `${voice} (systémový hlas macOS, ${rate} slov/min)`,
    extension: 'm4a',
    synthesize: (text, target) => {
      const textFile = join(work, 'in.txt');
      const aiff = join(work, 'out.aiff');
      writeFileSync(textFile, text);
      execFileSync('say', ['-v', voice, '-r', rate, '-f', textFile, '-o', aiff]);
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '32000', '-c', '1', aiff, target]);
      const info = execFileSync('afinfo', [target], { encoding: 'utf8' });
      return Promise.resolve(Number(/estimated duration: ([\d.]+)/.exec(info)?.[1] ?? 0));
    },
  };
}

function elevenLabsProvider(apiKey: string, voiceId: string): Provider {
  const model = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';
  const speed = Number(process.env.ELEVENLABS_SPEED ?? '1');
  const bitrate = 64;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_${bitrate}`;
  const request = (text: string) => fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: model, voice_settings: { speed } }),
  });
  return {
    label: `ElevenLabs, hlas ${voiceId}, model ${model}`,
    extension: 'mp3',
    synthesize: async (text, target) => {
      let response = await request(text);
      if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        response = await request(text);
      }
      if (!response.ok) throw new Error(`ElevenLabs vrátil ${response.status}: ${(await response.text()).slice(0, 400)}`);
      const audio = Buffer.from(await response.arrayBuffer());
      writeFileSync(target, audio);
      // Stálý datový tok: délka vychází z velikosti souboru.
      return (audio.length * 8) / (bitrate * 1000);
    },
  };
}

const args = process.argv.slice(2);
const all = args.includes('--all');
const dry = args.includes('--dry');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;

const content = JSON.parse(readFileSync(join(root, 'src/content/generated/content.json'), 'utf8')) as Content;
if (only && !content.lessons.some((lesson) => lesson.id === only)) {
  console.error(`✗ Lekce „${only}“ neexistuje.`);
  process.exit(1);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
if (apiKey && !voiceId) {
  console.error('✗ Je nastaven ELEVENLABS_API_KEY, ale chybí ELEVENLABS_VOICE_ID (ID hlasu z knihovny hlasů).');
  process.exit(1);
}
const provider = apiKey && voiceId ? elevenLabsProvider(apiKey, voiceId) : macProvider();

const manifestPath = join(root, 'public/media-manifest.json');
const previous = existsSync(manifestPath) ? parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8'))) : { voice: '', generatedAt: '', files: [] };
const known = new Map(previous.files.map((file) => [file.lessonId, file]));

interface Job { lessonId: string; text: string; hash: string; file: string; target: string }
const kept: AudioFile[] = [];
const jobs: Job[] = [];
for (const lesson of content.lessons) {
  const text = lessonSpeech(lesson);
  const hash = createHash('sha256').update(`${provider.label}\n${text}`).digest('hex').slice(0, 16);
  const file = `media/${lesson.moduleId}/${lesson.id}.${provider.extension}`;
  const old = known.get(lesson.id);
  const oldExists = old !== undefined && existsSync(join(root, 'public', old.file));
  const upToDate = oldExists && old.hash === hash;
  const wanted = only ? lesson.id === only : all || !upToDate;
  if (wanted) jobs.push({ lessonId: lesson.id, text, hash, file, target: join(root, 'public', file) });
  else if (oldExists) kept.push(old);
}

const characters = jobs.reduce((sum, job) => sum + job.text.length, 0);
console.log(`Hlas: ${provider.label}`);
console.log(`Ke generování: ${jobs.length} lekcí, ${characters} znaků.${kept.length ? ` Beze změny zůstává ${kept.length}.` : ''}`);
if (dry) {
  if (jobs[0]) console.log(`Ukázka čteného textu (${jobs[0].lessonId}):\n${jobs[0].text}`);
  process.exit(0);
}

const done: AudioFile[] = [];
let failure: unknown;
for (const job of jobs) {
  try {
    mkdirSync(dirname(job.target), { recursive: true });
    const seconds = await provider.synthesize(job.text, job.target);
    const old = known.get(job.lessonId);
    // Po změně hlasu má soubor jinou příponu; starý by v balíčku zůstal ležet.
    if (old && old.file !== job.file) rmSync(join(root, 'public', old.file), { force: true });
    done.push({ lessonId: job.lessonId, file: job.file, bytes: statSync(job.target).size, seconds: Math.round(seconds * 10) / 10, hash: job.hash });
    console.log(`  ${job.lessonId} · ${seconds.toFixed(0)} s`);
  } catch (error) {
    failure = error;
    break;
  }
}

// Manifest se zapíše i po chybě: hotové soubory zůstanou a další spuštění naváže.
const order = new Map(content.lessons.map((lesson, index) => [lesson.id, index]));
const doneIds = new Set(done.map((file) => file.lessonId));
const stale = jobs.filter((job) => !doneIds.has(job.lessonId)).flatMap((job) => { const old = known.get(job.lessonId); return old && existsSync(join(root, 'public', old.file)) ? [old] : []; });
const files = [...kept, ...done, ...stale].sort((a, b) => order.get(a.lessonId)! - order.get(b.lessonId)!);
const mixed = new Set(files.map((file) => file.file.split('.').pop())).size > 1 || (only !== undefined && previous.voice !== '' && previous.voice !== provider.label);
const manifest: AudioManifest = { voice: mixed ? `${provider.label} (část lekcí starším hlasem)` : provider.label, generatedAt: done.length > 0 || !previous.generatedAt ? new Date().toISOString() : previous.generatedAt, files };
writeFileSync(manifestPath, JSON.stringify(manifest));

const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
const seconds = files.reduce((sum, file) => sum + file.seconds, 0);
console.log(`${failure ? '✗' : '✓'} Zvuk: ${files.length} lekcí v manifestu, nově ${done.length}; celkem ${(bytes / 1024 / 1024).toFixed(1)} MB, ${(seconds / 60).toFixed(0)} min.`);
if (failure) {
  console.error(failure instanceof Error ? failure.message : failure);
  console.error('Generování se zastavilo. Hotové soubory zůstaly; po odstranění příčiny spusť příkaz znovu.');
  process.exit(1);
}
