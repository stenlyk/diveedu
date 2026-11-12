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
 *   npm run tts -- --only <id>           jedna lekce nebo jeden animovaný výklad na zkoušku (lze opakovat)
 *   npm run tts                          chybějící a změněné
 *   npm run tts -- --all                 všechno znovu
 *
 * Kromě shrnutí lekcí se namlouvají animované výklady (src/anim/defs.ts) do public/media/animace; u nich se ukládá
 * i začátek každé věty, podle kterého aplikace řídí scénu a titulky.
 *
 * Čtený text prochází slovníkem výslovnosti (src/audio/pronounce.ts). Výstup není v gitu.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIMATIONS } from '../src/anim/defs';
import { proportionalStarts, startsFromCharacters } from '../src/anim/timing';
import { type AnimationAudio, type AudioFile, type AudioManifest, EMPTY_MANIFEST, parseManifest } from '../src/audio/manifest';
import { lessonSpeech, toSpeech } from '../src/audio/pronounce';
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
  /** Totéž, navíc začátek každého znaku textu v sekundách, pokud to hlas umí. */
  synthesizeTimed?(text: string, target: string): Promise<{ seconds: number; characterStarts: number[] | null }>;
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
  const body = (text: string) => JSON.stringify({ text, model_id: model, voice_settings: { speed } });
  const post = async (endpoint: string, text: string): Promise<Response> => {
    const send = () => fetch(endpoint, { method: 'POST', headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' }, body: body(text) });
    let response = await send();
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      response = await send();
    }
    if (!response.ok) throw new Error(`ElevenLabs vrátil ${response.status}: ${(await response.text()).slice(0, 400)}`);
    return response;
  };
  const timedUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_${bitrate}`;
  return {
    label: `ElevenLabs, hlas ${voiceId}, model ${model}`,
    extension: 'mp3',
    synthesize: async (text, target) => {
      const audio = Buffer.from(await (await post(url, text)).arrayBuffer());
      writeFileSync(target, audio);
      // Stálý datový tok: délka vychází z velikosti souboru.
      return (audio.length * 8) / (bitrate * 1000);
    },
    synthesizeTimed: async (text, target) => {
      const payload = await (await post(timedUrl, text)).json() as { audio_base64?: string; alignment?: { character_start_times_seconds?: number[] } | null };
      if (typeof payload.audio_base64 !== 'string') throw new Error('ElevenLabs nevrátil zvuk.');
      const audio = Buffer.from(payload.audio_base64, 'base64');
      writeFileSync(target, audio);
      return { seconds: (audio.length * 8) / (bitrate * 1000), characterStarts: payload.alignment?.character_start_times_seconds ?? null };
    },
  };
}

const args = process.argv.slice(2);
const all = args.includes('--all');
const dry = args.includes('--dry');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;

const content = JSON.parse(readFileSync(join(root, 'src/content/generated/content.json'), 'utf8')) as Content;
if (only && !content.lessons.some((lesson) => lesson.id === only) && !ANIMATIONS.some((animation) => animation.id === only)) {
  console.error(`✗ Lekce ani animovaný výklad „${only}“ neexistuje.`);
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
const previous = existsSync(manifestPath) ? parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8'))) : EMPTY_MANIFEST;
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

// Animované výklady: jeden soubor na výklad, věty spojené mezerou.
interface AnimationJob { id: string; moduleId: string; spoken: string[]; text: string; hash: string; file: string; target: string }
const knownAnimations = new Map(previous.animations.map((item) => [item.id, item]));
const keptAnimations: AnimationAudio[] = [];
const animationJobs: AnimationJob[] = [];
for (const animation of ANIMATIONS) {
  const spoken = animation.cues.map(toSpeech);
  const text = spoken.join(' ');
  const hash = createHash('sha256').update(`${provider.label}\n${text}`).digest('hex').slice(0, 16);
  const file = `media/animace/${animation.id}.${provider.extension}`;
  const old = knownAnimations.get(animation.id);
  const oldExists = old !== undefined && existsSync(join(root, 'public', old.file));
  const wanted = only ? animation.id === only : all || !(oldExists && old.hash === hash);
  if (wanted) animationJobs.push({ id: animation.id, moduleId: animation.moduleId, spoken, text, hash, file, target: join(root, 'public', file) });
  else if (oldExists) keptAnimations.push(old);
}

const characters = jobs.reduce((sum, job) => sum + job.text.length, 0) + animationJobs.reduce((sum, job) => sum + job.text.length, 0);
console.log(`Hlas: ${provider.label}`);
console.log(`Ke generování: ${jobs.length} lekcí a ${animationJobs.length} animovaných výkladů, ${characters} znaků.${kept.length + keptAnimations.length ? ` Beze změny zůstává ${kept.length + keptAnimations.length}.` : ''}`);
if (dry) {
  const sample = jobs[0] ? { id: jobs[0].lessonId, text: jobs[0].text } : animationJobs[0];
  if (sample) console.log(`Ukázka čteného textu (${sample.id}):\n${sample.text}`);
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

const doneAnimations: AnimationAudio[] = [];
for (const job of failure ? [] : animationJobs) {
  try {
    mkdirSync(dirname(job.target), { recursive: true });
    const timed = provider.synthesizeTimed ? await provider.synthesizeTimed(job.text, job.target) : { seconds: await provider.synthesize(job.text, job.target), characterStarts: null };
    const cues = (timed.characterStarts && startsFromCharacters(job.spoken, timed.characterStarts)) ?? proportionalStarts(job.spoken, timed.seconds);
    const old = knownAnimations.get(job.id);
    if (old && old.file !== job.file) rmSync(join(root, 'public', old.file), { force: true });
    doneAnimations.push({ id: job.id, moduleId: job.moduleId, file: job.file, bytes: statSync(job.target).size, seconds: Math.round(timed.seconds * 10) / 10, hash: job.hash, cues });
    console.log(`  výklad ${job.id} · ${timed.seconds.toFixed(0)} s · ${timed.characterStarts ? 'časové značky z hlasu' : 'časování odhadem'}`);
  } catch (error) {
    failure = error;
    break;
  }
}
const doneAnimationIds = new Set(doneAnimations.map((item) => item.id));
const staleAnimations = animationJobs.filter((job) => !doneAnimationIds.has(job.id)).flatMap((job) => { const old = knownAnimations.get(job.id); return old && existsSync(join(root, 'public', old.file)) ? [old] : []; });
const animationOrder = new Map(ANIMATIONS.map((animation, index) => [animation.id, index]));
const animations = [...keptAnimations, ...doneAnimations, ...staleAnimations].sort((a, b) => animationOrder.get(a.id)! - animationOrder.get(b.id)!);

// Manifest se zapíše i po chybě: hotové soubory zůstanou a další spuštění naváže.
const order = new Map(content.lessons.map((lesson, index) => [lesson.id, index]));
const doneIds = new Set(done.map((file) => file.lessonId));
const stale = jobs.filter((job) => !doneIds.has(job.lessonId)).flatMap((job) => { const old = known.get(job.lessonId); return old && existsSync(join(root, 'public', old.file)) ? [old] : []; });
const files = [...kept, ...done, ...stale].sort((a, b) => order.get(a.lessonId)! - order.get(b.lessonId)!);
const mixed = new Set([...files, ...animations].map((file) => file.file.split('.').pop())).size > 1 || (only !== undefined && previous.voice !== '' && previous.voice !== provider.label);
const manifest: AudioManifest = { voice: mixed ? `${provider.label} (část lekcí starším hlasem)` : provider.label, generatedAt: done.length + doneAnimations.length > 0 || !previous.generatedAt ? new Date().toISOString() : previous.generatedAt, files, animations };
writeFileSync(manifestPath, JSON.stringify(manifest));

const bytes = [...files, ...animations].reduce((sum, file) => sum + file.bytes, 0);
const seconds = [...files, ...animations].reduce((sum, file) => sum + file.seconds, 0);
console.log(`${failure ? '✗' : '✓'} Zvuk: ${files.length} lekcí a ${animations.length} výkladů v manifestu, nově ${done.length + doneAnimations.length}; celkem ${(bytes / 1024 / 1024).toFixed(1)} MB, ${(seconds / 60).toFixed(0)} min.`);
if (failure) {
  console.error(failure instanceof Error ? failure.message : failure);
  console.error('Generování se zastavilo. Hotové soubory zůstaly; po odstranění příčiny spusť příkaz znovu.');
  process.exit(1);
}
