import {
  assertFraction,
  assertNonNegative,
  assertPositive,
  assertPositiveFraction,
  CalcInputError,
} from './errors';
import { DEFAULT_ENV, type Env } from './env';
import { absPressure, depthFromPressure } from './pressure';

/** Parciální tlak kyslíku v barech. ppO2 = fO2 · P_abs */
export function ppO2(fO2: number, depthM: number, env: Env = DEFAULT_ENV): number {
  assertFraction(fO2, 'fO2');
  return fO2 * absPressure(depthM, env);
}

/**
 * Maximální operační hloubka v metrech. MOD = (ppO2max / fO2 − 1) · 10
 * Nezaokrouhluje; pro zobrazení zaokrouhluj dolů. Nikdy nevrací zápornou hloubku.
 */
export function mod(fO2: number, ppO2MaxBar: number, env: Env = DEFAULT_ENV): number {
  assertPositiveFraction(fO2, 'fO2');
  assertPositive(ppO2MaxBar, 'ppO2 max');
  return Math.max(0, depthFromPressure(ppO2MaxBar / fO2, env));
}

/** Nejbohatší směs pro danou hloubku a limit ppO2 (frakce O2, nejvýše 1). */
export function bestMix(depthM: number, ppO2MaxBar: number, env: Env = DEFAULT_ENV): number {
  assertPositive(ppO2MaxBar, 'ppO2 max');
  return Math.min(1, ppO2MaxBar / absPressure(depthM, env));
}

/**
 * Minimální hloubka, ve které je směs dýchatelná (ppO2 ≥ ppO2min).
 * Pro normoxické směsi vrací 0. Používá se pro hypoxické trimixy.
 */
export function minDepthForPpO2(fO2: number, ppO2MinBar: number, env: Env = DEFAULT_ENV): number {
  assertPositiveFraction(fO2, 'fO2');
  assertPositive(ppO2MinBar, 'ppO2 min');
  return Math.max(0, depthFromPressure(ppO2MinBar / fO2, env));
}

/**
 * Limity jedné expozice CNS podle NOAA Diving Manual: [ppO2 v barech, minuty].
 * Mezi řádky se interpoluje lineárně.
 */
export const NOAA_CNS_TABLE: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [0.6, 720],
  [0.7, 570],
  [0.8, 450],
  [0.9, 360],
  [1.0, 300],
  [1.1, 240],
  [1.2, 210],
  [1.3, 180],
  [1.4, 150],
  [1.5, 120],
  [1.6, 45],
] as const);

/** Pod touto hodnotou ppO2 se CNS zátěž nepočítá. */
export const CNS_THRESHOLD_BAR = 0.5;
export const CNS_TABLE_MAX_BAR = 1.6;

/**
 * Povolená doba jedné expozice v minutách.
 * - ppO2 ≤ 0,5 bar: Infinity (zátěž se nepočítá)
 * - 0,5 < ppO2 < 0,6: konzervativně limit pro 0,6 bar (tabulka níž nejde)
 * - ppO2 > 1,6 bar: null = mimo tabulku; záměrně se neextrapoluje
 */
export function cnsLimitMinutes(ppO2Bar: number): number | null {
  assertNonNegative(ppO2Bar, 'ppO2');
  if (ppO2Bar <= CNS_THRESHOLD_BAR) return Infinity;
  if (ppO2Bar > CNS_TABLE_MAX_BAR + 1e-9) return null;
  let [p0, t0] = NOAA_CNS_TABLE[0]!;
  for (const [p1, t1] of NOAA_CNS_TABLE) {
    if (ppO2Bar <= p1) {
      // První řádek tabulky (p1 === p0) vrací přímo svůj limit.
      const ratio = p1 === p0 ? 0 : (ppO2Bar - p0) / (p1 - p0);
      return t0 + (t1 - t0) * ratio;
    }
    p0 = p1;
    t0 = t1;
  }
  // Zaokrouhlovací šum těsně nad 1,6 bar: platí poslední řádek tabulky.
  return t0;
}

/** CNS % za dobu strávenou na daném ppO2. null = ppO2 mimo tabulku NOAA. */
export function cnsPercent(ppO2Bar: number, minutes: number): number | null {
  assertNonNegative(minutes, 'čas');
  const limit = cnsLimitMinutes(ppO2Bar);
  if (limit === null) return null;
  return (minutes / limit) * 100;
}

export interface OxygenSegment {
  ppO2Bar: number;
  minutes: number;
}

/** Součet CNS % přes úseky ponoru. null, pokud je některý úsek mimo tabulku. */
export function cnsTotalPercent(segments: readonly OxygenSegment[]): number | null {
  let total = 0;
  for (const segment of segments) {
    const part = cnsPercent(segment.ppO2Bar, segment.minutes);
    if (part === null) return null;
    total += part;
  }
  return total;
}

/** Jednotky plicní toxicity. OTU = t · ((ppO2 − 0,5) / 0,5)^0,83; pod 0,5 bar je 0. */
export function otu(ppO2Bar: number, minutes: number): number {
  assertNonNegative(ppO2Bar, 'ppO2');
  assertNonNegative(minutes, 'čas');
  if (ppO2Bar <= CNS_THRESHOLD_BAR) return 0;
  return minutes * Math.pow((ppO2Bar - 0.5) / 0.5, 0.83);
}

export function otuTotal(segments: readonly OxygenSegment[]): number {
  return segments.reduce((sum, s) => sum + otu(s.ppO2Bar, s.minutes), 0);
}

/**
 * Průměrný denní limit OTU pro vícedenní potápění (REPEX, Hamilton 1989).
 * Index = počet dní − 1; od 11. dne dál 300 OTU/den.
 */
export const REPEX_DAILY_OTU: readonly number[] = Object.freeze([
  850, 700, 620, 525, 460, 420, 380, 350, 330, 310, 300,
]);

export function repexDailyLimit(days: number): number {
  assertPositive(days, 'počet dní');
  const index = Math.min(Math.ceil(days), REPEX_DAILY_OTU.length) - 1;
  return REPEX_DAILY_OTU[index]!;
}

export interface OtuMultiDaySummary {
  perDay: number[];
  total: number;
  dailyLimit: number;
  totalLimit: number;
  withinLimit: boolean;
}

/** Souhrn OTU přes více dní proti limitu REPEX. */
export function otuMultiDay(dailyOtu: readonly number[]): OtuMultiDaySummary {
  if (dailyOtu.length === 0) throw new CalcInputError('zadej alespoň jeden den');
  dailyOtu.forEach((value) => assertNonNegative(value, 'denní OTU'));
  const total = dailyOtu.reduce((a, b) => a + b, 0);
  const dailyLimit = repexDailyLimit(dailyOtu.length);
  const totalLimit = dailyLimit * dailyOtu.length;
  return { perDay: [...dailyOtu], total, dailyLimit, totalLimit, withinLimit: total <= totalLimit };
}
