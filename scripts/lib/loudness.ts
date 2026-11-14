/**
 * Normalizace hlasitosti nahrávek podle EBU R128 (měření filtrem loudnorm v ffmpeg, úprava zesílením a limiterem).
 * Hlas z TTS má mezi soubory rozdíly přes 15 dB; posluchač by jinak musel u každé lekce sahat na hlasitost.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, rmSync } from 'node:fs';

/**
 * Cíl pro řeč poslouchanou na telefonu: −16 LUFS, špička nejvýš −1,5 dBTP.
 * Úprava míří na ±0,3 LU (aim); soubor se znovu upravuje, až když je mimo toleranci 1 LU – rozdíl pod 1 LU sluch nepozná
 * a opakované spuštění tak soubory zbytečně nepřekóduje.
 */
export const LOUDNESS_TARGET = { integrated: -16, truePeak: -1.5, range: 11, tolerance: 1, aim: 0.3 } as const;
type Target = typeof LOUDNESS_TARGET;

export interface Loudness {
  /** Integrovaná hlasitost v LUFS. */
  integrated: number;
  /** Nejvyšší skutečná špička v dBTP. */
  truePeak: number;
  range: number;
  threshold: number;
}

/** Je soubor mimo cíl? Tolerance chrání před zbytečným překódováním (každé ubírá kvalitu). */
export function needsNormalization(measured: Loudness, target: Target = LOUDNESS_TARGET): boolean {
  return Math.abs(measured.integrated - target.integrated) > target.tolerance || measured.truePeak > target.truePeak + 0.5;
}

/** Spustí ffmpeg a vrátí jeho stderr; tam loudnorm vypisuje měření. */
function ffmpeg(args: string[]): string {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' });
  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Chybí ffmpeg. Nainstaluj ho (macOS: brew install ffmpeg).');
  if (result.status !== 0) throw new Error(`ffmpeg selhal: ${result.stderr.split('\n').slice(-4).join(' ')}`);
  return result.stderr;
}

const filter = (target: Target) => `loudnorm=I=${target.integrated}:TP=${target.truePeak}:LRA=${target.range}`;

/** Z výpisu ffmpeg vytáhne JSON s měřením (poslední blok ve složených závorkách). */
export function parseLoudnormOutput(stderr: string): Loudness {
  const start = stderr.lastIndexOf('{');
  const end = stderr.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('ffmpeg nevrátil měření hlasitosti');
  const json = JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
  const loudness = { integrated: Number(json.input_i), truePeak: Number(json.input_tp), range: Number(json.input_lra), threshold: Number(json.input_thresh) };
  if (Object.values(loudness).some((value) => !Number.isFinite(value))) throw new Error('Měření hlasitosti není úplné (ticho nebo poškozený soubor?)');
  return loudness;
}

/** Změří hlasitost souboru (první průchod loudnorm). */
export function measureLoudness(path: string, target: Target = LOUDNESS_TARGET): Loudness {
  return parseLoudnormOutput(ffmpeg(['-i', path, '-af', `${filter(target)}:print_format=json`, '-f', 'null', '-']));
}

export interface NormalizeResult {
  before: Loudness;
  after: Loudness;
  changed: boolean;
}

/**
 * Upraví hlasitost MP3 na cíl a přepíše soubor.
 * Zesílení se spočítá z měření; limiter za ním ořízne jen krátké špičky (souhlásky), které by po zesílení přesáhly strop.
 * Limiter běží na čtyřnásobném vzorkování, aby zachytil i špičky mezi vzorky (true peak).
 * Limiter hlasitost mírně sníží a kodér zvedne špičky, proto se výsledek změří a při odchylce nad `aim` nebo špičce nad stropem
 * se kóduje znovu z originálu s opraveným zesílením a stropem –
 * zvuk tak projde kodérem vždy jen jednou.
 * Filtr loudnorm v lineárním režimu by soubory s ostrými špičkami nechal tišší, v dynamickém u krátkých nahrávek nemíří přesně.
 * Formát zůstává: MP3, 44,1 kHz, mono, 64 kb/s. Soubor, který už v cíli je, se nepřekódovává.
 */
export function normalizeLoudness(path: string, target: Target = LOUDNESS_TARGET): NormalizeResult {
  const before = measureLoudness(path, target);
  if (!needsNormalization(before, target)) return { before, after: before, changed: false };
  // Strop limiteru o 1 dB níž: kodér MP3 špičky zvedá. Když to nestačí, další pokus ho sníží o přesah.
  let limitDb = target.truePeak - 1;
  const temporary = `${path}.normalizing.mp3`;
  let gainDb = target.integrated - before.integrated;
  let after = before;
  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const limit = Math.pow(10, limitDb / 20).toFixed(4);
      const chain = `aresample=176400,volume=${gainDb.toFixed(2)}dB,alimiter=limit=${limit}:attack=5:release=50:level=false,aresample=44100`;
      ffmpeg(['-y', '-i', path, '-af', chain, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', temporary]);
      after = measureLoudness(temporary, target);
      const miss = target.integrated - after.integrated;
      const overshoot = after.truePeak - target.truePeak;
      if (Math.abs(miss) <= target.aim && overshoot <= 0) break;
      gainDb += miss;
      if (overshoot > 0) limitDb -= overshoot;
    }
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
  return { before, after, changed: true };
}

/** Otisk obsahu souboru: mění se s každou úpravou zvuku, aby aplikace nehrála starou verzi z mezipaměti. */
export function audioHash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);
}
