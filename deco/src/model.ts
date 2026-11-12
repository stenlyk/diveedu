/**
 * Bühlmannův model sycení tkání s gradient factors. JEN PRO VÝUKU A VIZUALIZACI –
 * není to plánovač ponorů a výstup se nesmí použít pro skutečný ponor.
 */
import { CalcInputError, type Gas } from '@diveedu/calc';
import { COMPARTMENTS, HE_A, HE_B, HE_HALF_TIMES, N2_A, N2_B, N2_HALF_TIMES } from './tables';

export interface DecoEnv {
  /** Tlak na hladině v barech. */
  surfaceBar: number;
  /** Přírůstek tlaku na metr hloubky. */
  barPerMeter: number;
  /** Tlak vodní páry v plicích (Bühlmann 0,0627 bar). */
  waterVaporBar: number;
  /** Frakce dusíku ve vzduchu pro výchozí nasycení tkání. */
  airFN2: number;
}

/** Výuková konvence aplikace: 10 m = 1 bar, hladina 1 bar. */
export const TEACHING_ENV: DecoEnv = Object.freeze({ surfaceBar: 1, barPerMeter: 0.1, waterVaporBar: 0.0627, airFN2: 0.79 });
/** Konvence Subsurface pro srovnávací testy: 1 atm, slaná voda 1,03 kg/l. */
export const SUBSURFACE_ENV: DecoEnv = Object.freeze({ surfaceBar: 1.01325, barPerMeter: (1.03 * 9.80665) / 100, waterVaporBar: 0.0627, airFN2: 0.7808 });

export interface Tissues {
  /** Tlak dusíku v každém z 16 kompartmentů (bar). */
  n2: number[];
  /** Tlak helia v každém z 16 kompartmentů (bar). */
  he: number[];
}

export const ambientBar = (depthM: number, env: DecoEnv): number => env.surfaceBar + depthM * env.barPerMeter;
export const depthOfBar = (bar: number, env: DecoEnv): number => (bar - env.surfaceBar) / env.barPerMeter;

/** Tkáně v rovnováze se vzduchem na hladině. */
export function surfaceTissues(env: DecoEnv = TEACHING_ENV): Tissues {
  const n2 = (env.surfaceBar - env.waterVaporBar) * env.airFN2;
  return { n2: Array<number>(COMPARTMENTS).fill(n2), he: Array<number>(COMPARTMENTS).fill(0) };
}

/** Parciální tlak inertního plynu v plicních sklípcích (po odečtení vodní páry). */
function inspired(fraction: number, ambient: number, env: DecoEnv): number {
  return Math.max(0, ambient - env.waterVaporBar) * fraction;
}

/** Schreinerova rovnice pro lineární změnu vdechovaného tlaku (rate = 0 dává Haldaneovu rovnici). */
function schreiner(p0: number, inspired0: number, rate: number, minutes: number, halfTime: number): number {
  const k = Math.LN2 / halfTime;
  return inspired0 + rate * (minutes - 1 / k) - (inspired0 - p0 - rate / k) * Math.exp(-k * minutes);
}

/**
 * Sycení tkání při přesunu z hloubky depth1 do depth2 stálou rychlostí za daný čas.
 * Pro depth1 === depth2 jde o pobyt ve stálé hloubce.
 */
export function load(tissues: Tissues, gas: Gas, depth1M: number, depth2M: number, minutes: number, env: DecoEnv = TEACHING_ENV): Tissues {
  if (!(minutes >= 0) || !(depth1M >= 0) || !(depth2M >= 0)) throw new CalcInputError('čas a hloubka nesmí být záporné');
  if (minutes === 0) return { n2: [...tissues.n2], he: [...tissues.he] };
  const fN2 = Math.max(0, 1 - gas.fO2 - gas.fHe);
  const p1 = ambientBar(depth1M, env);
  const ratePerMin = (ambientBar(depth2M, env) - p1) / minutes;
  return {
    n2: tissues.n2.map((p, i) => schreiner(p, inspired(fN2, p1, env), ratePerMin * fN2, minutes, N2_HALF_TIMES[i]!)),
    he: tissues.he.map((p, i) => schreiner(p, inspired(gas.fHe, p1, env), ratePerMin * gas.fHe, minutes, HE_HALF_TIMES[i]!)),
  };
}

/** Koeficienty a, b kompartmentu vážené podle poměru dusíku a helia v tkáni. */
export function coefficients(tissues: Tissues, i: number): { a: number; b: number; inert: number } {
  const n2 = tissues.n2[i]!;
  const he = tissues.he[i]!;
  const inert = n2 + he;
  if (inert <= 0) return { a: N2_A[i]!, b: N2_B[i]!, inert: 0 };
  return { a: (N2_A[i]! * n2 + HE_A[i]! * he) / inert, b: (N2_B[i]! * n2 + HE_B[i]! * he) / inert, inert };
}

/** M-hodnota: nejvyšší tolerovaný tlak inertního plynu v tkáni při daném okolním tlaku. M = a + P / b */
export function mValue(tissues: Tissues, i: number, ambient: number): number {
  const { a, b } = coefficients(tissues, i);
  return a + ambient / b;
}

/**
 * Nejnižší okolní tlak, který kompartment snese při daném gradient factoru (0–1).
 * Vychází z podmínky p_tkáň ≤ P + GF · (M − P).
 */
export function toleratedAmbient(tissues: Tissues, i: number, gf: number): number {
  const { a, b, inert } = coefficients(tissues, i);
  return (inert - a * gf) / (gf / b - gf + 1);
}

/** Strop: nejmenší hloubka, do které lze vystoupat, přes všechny kompartmenty. Může být záporný (lze na hladinu). */
export function ceilingM(tissues: Tissues, gf: number, env: DecoEnv = TEACHING_ENV): number {
  let worst = -Infinity;
  for (let i = 0; i < COMPARTMENTS; i++) worst = Math.max(worst, toleratedAmbient(tissues, i, gf));
  return depthOfBar(worst, env);
}

export interface GfReading {
  /** Aktuální gradient factor vedoucího kompartmentu v procentech (GF99). Záporný = tkáň je pod okolním tlakem. */
  percent: number;
  /** Index vedoucího kompartmentu (0–15). */
  compartment: number;
}

/** GF99: jak velkou část rozdílu mezi okolním tlakem a M-hodnotou vedoucí kompartment právě čerpá. */
export function gfNow(tissues: Tissues, depthM: number, env: DecoEnv = TEACHING_ENV): GfReading {
  const ambient = ambientBar(depthM, env);
  let best: GfReading = { percent: -Infinity, compartment: 0 };
  for (let i = 0; i < COMPARTMENTS; i++) {
    const percent = ((coefficients(tissues, i).inert - ambient) / (mValue(tissues, i, ambient) - ambient)) * 100;
    if (percent > best.percent) best = { percent, compartment: i };
  }
  return best;
}

/** Surfacing GF: jaký gradient factor by vznikl okamžitým výstupem na hladinu. */
export function surfacingGf(tissues: Tissues, env: DecoEnv = TEACHING_ENV): GfReading {
  return gfNow(tissues, 0, env);
}
