/**
 * Výpočet dekompresního rozvrhu pro jednoduchý profil (sestup – dno – výstup).
 * JEN PRO VÝUKU: konvence jsou zjednodušené a výsledek není plán ponoru.
 */
import { CalcInputError, type Gas, validateGas } from '@diveedu/calc';
import { ceilingM, type DecoEnv, gfNow, load, surfaceTissues, TEACHING_ENV, type Tissues } from './model';

export interface PlanGas {
  gas: Gas;
  /** Hloubka, od které se na plyn při výstupu přepíná. Plyn pro dno ji nemá. */
  switchDepthM?: number;
}

export interface PlanInput {
  depthM: number;
  /** Čas od opuštění hladiny do zahájení výstupu (včetně sestupu). */
  bottomMinutes: number;
  /** První plyn je pro sestup a dno; další jsou dekompresní. */
  gases: PlanGas[];
  /** Gradient factors v procentech. */
  gfLow: number;
  gfHigh: number;
  descentRate?: number;
  ascentRate?: number;
  /** Rychlost výstupu z poslední zastávky na hladinu. */
  surfaceRate?: number;
  /** Hloubka poslední zastávky: 3 nebo 6 m. */
  lastStopM?: 3 | 6;
  /** Minimální doba po přepnutí plynu, je-li přepnutí mimo zastávku (min). */
  switchMinutes?: number;
  env?: DecoEnv;
}

export interface PlanStop {
  depthM: number;
  minutes: number;
  gasIndex: number;
}

export interface Sample {
  /** Čas od začátku ponoru v minutách. */
  t: number;
  depthM: number;
  gasIndex: number;
  tissues: Tissues;
  /** Strop při gradient factoru platném v této fázi ponoru. */
  ceilingM: number;
  gf99: number;
  leadingCompartment: number;
}

export interface EducationalPlan {
  /** Pojistka pro UI: výsledek lze vykreslit jen s upozorněním, že nejde o plán ponoru. */
  readonly educationalOnly: true;
  stops: PlanStop[];
  /** Celkový čas ponoru v minutách. */
  runtimeMin: number;
  /** Čas výstupu včetně zastávek. */
  ascentMin: number;
  firstStopM: number;
  surfacingGfPercent: number;
  samples: Sample[];
}

const STOP_STEP = 3;
const MAX_STOP_MINUTES = 600;
const EPS = 1e-6;

export function planDive(input: PlanInput): EducationalPlan {
  const env = input.env ?? TEACHING_ENV;
  const descentRate = input.descentRate ?? 20;
  const ascentRate = input.ascentRate ?? 9;
  const surfaceRate = input.surfaceRate ?? ascentRate;
  const lastStopM = input.lastStopM ?? 3;
  const switchMinutes = input.switchMinutes ?? 0;
  const gfLow = input.gfLow / 100;
  const gfHigh = input.gfHigh / 100;

  if (!(input.depthM > 0)) throw new CalcInputError('hloubka musí být kladná');
  if (!(input.bottomMinutes > 0)) throw new CalcInputError('čas na dně musí být kladný');
  if (!(gfLow > 0 && gfLow <= gfHigh && gfHigh <= 1.2)) throw new CalcInputError('gradient factors musí splňovat 0 < GF low ≤ GF high ≤ 120');
  if (!(descentRate > 0 && ascentRate > 0 && surfaceRate > 0)) throw new CalcInputError('rychlosti musí být kladné');
  if (input.gases.length === 0) throw new CalcInputError('chybí plyn pro dno');
  input.gases.forEach((entry) => validateGas(entry.gas));
  const descentMinutes = input.depthM / descentRate;
  if (descentMinutes > input.bottomMinutes) throw new CalcInputError('čas na dně je kratší než sestup');

  let tissues = surfaceTissues(env);
  let t = 0;
  let depth = 0;
  let gasIndex = 0;
  let firstStopM: number | null = null;
  const samples: Sample[] = [];
  const stops: PlanStop[] = [];

  /** Gradient factor platný v dané hloubce: před první zastávkou GF low, pak lineárně k GF high na hladině. */
  const gfAt = (d: number): number => (firstStopM === null ? gfLow : gfHigh + (gfLow - gfHigh) * Math.min(1, d / firstStopM));
  const record = () => {
    const reading = gfNow(tissues, depth, env);
    samples.push({ t, depthM: depth, gasIndex, tissues, ceilingM: Math.max(0, ceilingM(tissues, gfAt(depth), env)), gf99: reading.percent, leadingCompartment: reading.compartment });
  };
  /** Posun v čase po krocích nejvýš 1 min, aby měl simulátor plynulá data. */
  const move = (toDepth: number, minutes: number) => {
    const gas = input.gases[gasIndex]!.gas;
    const steps = Math.max(1, Math.ceil(minutes - EPS));
    const from = depth;
    for (let i = 1; i <= steps; i++) {
      const d0 = from + ((toDepth - from) * (i - 1)) / steps;
      const d1 = from + ((toDepth - from) * i) / steps;
      tissues = load(tissues, gas, d0, d1, minutes / steps, env);
      depth = d1;
      t += minutes / steps;
      record();
    }
  };
  /** Nejbohatší plyn, na který už lze v dané hloubce přepnout. */
  const bestGas = (d: number): number => {
    let best = gasIndex;
    input.gases.forEach((entry, i) => {
      if (i > 0 && entry.switchDepthM !== undefined && d <= entry.switchDepthM + EPS && entry.gas.fO2 > input.gases[best]!.gas.fO2) best = i;
    });
    return best;
  };
  const nextStopAbove = (d: number): number => {
    const next = Math.ceil((d - EPS) / STOP_STEP - 1) * STOP_STEP;
    return next < lastStopM ? 0 : next;
  };
  const rateTo = (target: number) => (target === 0 ? surfaceRate : ascentRate);
  /** Lze z aktuálního stavu vystoupat do cílové hloubky, aniž by se tam porušil strop? */
  const canAscendTo = (target: number): boolean => {
    const after = load(tissues, input.gases[gasIndex]!.gas, depth, target, (depth - target) / rateTo(target), env);
    const gf = firstStopM === null ? gfLow : target === 0 ? gfHigh : gfAt(target);
    return ceilingM(after, gf, env) <= target + EPS;
  };

  /** Zapíše čas na zastávce; čas po přepnutí plynu a čekání ve stejné hloubce se sloučí. */
  const addStop = (minutes: number) => {
    const last = stops[stops.length - 1];
    if (last && Math.abs(last.depthM - depth) < EPS) {
      last.minutes += minutes;
      last.gasIndex = gasIndex;
    } else stops.push({ depthM: depth, minutes, gasIndex });
  };

  record();
  move(input.depthM, descentMinutes);
  if (input.bottomMinutes - descentMinutes > EPS) move(input.depthM, input.bottomMinutes - descentMinutes);
  const ascentStart = t;

  while (depth > EPS) {
    const target = nextStopAbove(depth);
    let waited = 0;
    while (!canAscendTo(target)) {
      if (firstStopM === null) firstStopM = depth;
      if (waited >= MAX_STOP_MINUTES) throw new CalcInputError('dekomprese na zastávce přesáhla výukový rozsah modelu');
      move(depth, 1);
      waited += 1;
    }
    if (waited > 0) addStop(waited);
    move(target, (depth - target) / rateTo(target));
    // Přepnutí plynu po příchodu do hloubky, kde už je bohatší plyn použitelný.
    const better = bestGas(depth);
    if (depth > EPS && better !== gasIndex) {
      gasIndex = better;
      record();
      if (switchMinutes > 0) {
        move(depth, switchMinutes);
        addStop(switchMinutes);
      }
    }
  }

  return {
    educationalOnly: true,
    stops,
    runtimeMin: t,
    ascentMin: t - ascentStart,
    firstStopM: firstStopM ?? 0,
    surfacingGfPercent: gfNow(tissues, 0, env).percent,
    samples,
  };
}

/** Má plán aspoň jednu zastávku? Dekomprese mimo rozsah modelu se počítá jako „ano“. */
function needsStops(input: PlanInput): boolean {
  try {
    return planDive(input).stops.length > 0;
  } catch (error) {
    if (error instanceof CalcInputError && /výukový rozsah/.test(error.message)) return true;
    throw error;
  }
}

/** Bezdekompresní limit: nejdelší čas na dně (celé minuty), po kterém plán nemá žádnou zastávku. */
export function noDecoLimit(input: Omit<PlanInput, 'bottomMinutes'>, maxMinutes = 300): number {
  let low = Math.max(1, Math.ceil(input.depthM / (input.descentRate ?? 20)));
  if (needsStops({ ...input, bottomMinutes: low })) return 0;
  let high = maxMinutes;
  if (!needsStops({ ...input, bottomMinutes: high })) return maxMinutes;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (needsStops({ ...input, bottomMinutes: mid })) high = mid;
    else low = mid;
  }
  return low;
}
