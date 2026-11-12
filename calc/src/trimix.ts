import { assertNonNegative, assertPositive } from './errors';
import { DEFAULT_ENV, type Env } from './env';
import { AIR_FN2, type Gas, validateGas } from './gas';
import { DENSITY_HE, DENSITY_N2, DENSITY_O2, gasDensity } from './density';
import { end } from './narcosis';
import { ppO2 } from './oxygen';
import { absPressure } from './pressure';

const EPS = 1e-9;

export interface OptimalTrimixInput {
  depthM: number;
  ppO2MaxBar: number;
  /** Nejvyšší přijatelná ekvivalentní narkotická hloubka. */
  endMaxM: number;
  /** Počítat kyslík jako narkotický (výchozí true). */
  o2Narcotic?: boolean;
  /** Volitelný limit hustoty plynu v g/l. */
  densityMaxGL?: number;
}

export interface OptimalTrimixResult {
  /** Nezaokrouhlená směs: nejvíc kyslíku a nejméně helia, které splní limity. */
  gas: Gas;
  /** false = limity nejdou splnit ani s nulovým dusíkem. */
  feasible: boolean;
  /** Který limit určil obsah helia. */
  limitedBy: 'none' | 'end' | 'density';
}

/**
 * Optimální trimix pro hloubku: fO2 z limitu ppO2 (best mix) a nejmenší fHe,
 * které udrží END a případně hustotu pod limitem.
 */
export function optimalTrimix(input: OptimalTrimixInput, env: Env = DEFAULT_ENV): OptimalTrimixResult {
  assertPositive(input.ppO2MaxBar, 'ppO2 max');
  assertNonNegative(input.endMaxM, 'END max');
  const o2Narcotic = input.o2Narcotic ?? true;
  const p = absPressure(input.depthM, env);
  const pEnd = absPressure(input.endMaxM, env);
  const fO2 = Math.min(1, input.ppO2MaxBar / p);

  const heForEnd = o2Narcotic ? 1 - pEnd / p : 1 - fO2 - (AIR_FN2 * pEnd) / p;
  let heForDensity = 0;
  if (input.densityMaxGL !== undefined) {
    assertPositive(input.densityMaxGL, 'limit hustoty');
    heForDensity =
      (DENSITY_O2 * fO2 + DENSITY_N2 * (1 - fO2) - input.densityMaxGL / p) /
      (DENSITY_N2 - DENSITY_HE);
  }

  let fHe = 0;
  let limitedBy: OptimalTrimixResult['limitedBy'] = 'none';
  if (heForEnd > fHe + EPS) {
    fHe = heForEnd;
    limitedBy = 'end';
  }
  if (heForDensity > fHe + EPS) {
    fHe = heForDensity;
    limitedBy = 'density';
  }

  const maxHe = 1 - fO2;
  const feasible = fHe <= maxHe + EPS;
  return { gas: { fO2, fHe: Math.min(fHe, maxHe) }, feasible, limitedBy };
}

/**
 * Zaokrouhlení směsi na celá procenta bezpečným směrem:
 * kyslík dolů (nižší ppO2), helium nahoru (nižší END a hustota).
 */
export function practicalTrimix(gas: Gas): Gas {
  validateGas(gas);
  const fO2 = Math.floor(gas.fO2 * 100 + EPS) / 100;
  const fHe = Math.min(Math.ceil(gas.fHe * 100 - EPS) / 100, Math.round((1 - fO2) * 100) / 100);
  return { fO2, fHe };
}

export interface MixLimits {
  ppO2MinBar: number;
  ppO2MaxBar: number;
  endMaxM: number;
  densityMaxGL: number;
  o2Narcotic?: boolean;
}

export interface MixCheck {
  ppO2Bar: number;
  endM: number;
  densityGL: number;
  hypoxic: boolean;
  ppO2TooHigh: boolean;
  endTooDeep: boolean;
  tooDense: boolean;
  allowed: boolean;
}

/** Vyhodnotí směs v dané hloubce proti limitům (podklad pro ternární diagram). */
export function checkMix(gas: Gas, depthM: number, limits: MixLimits, env: Env = DEFAULT_ENV): MixCheck {
  const ppO2Bar = ppO2(gas.fO2, depthM, env);
  const endM = end(gas, depthM, { o2Narcotic: limits.o2Narcotic ?? true }, env);
  const densityGL = gasDensity(gas, depthM, env);
  const hypoxic = ppO2Bar < limits.ppO2MinBar - EPS;
  const ppO2TooHigh = ppO2Bar > limits.ppO2MaxBar + EPS;
  const endTooDeep = endM > limits.endMaxM + EPS;
  const tooDense = densityGL > limits.densityMaxGL + EPS;
  return {
    ppO2Bar,
    endM,
    densityGL,
    hypoxic,
    ppO2TooHigh,
    endTooDeep,
    tooDense,
    allowed: !(hypoxic || ppO2TooHigh || endTooDeep || tooDense),
  };
}

/**
 * Nejmenší frakce helia, při které END (O2 narkotický) nepřekročí limit:
 * fHe = 1 − (END + 10) / (d + 10). Nikdy záporná.
 */
export function minHeForEnd(depthM: number, endMaxM: number, env: Env = DEFAULT_ENV): number {
  assertNonNegative(endMaxM, 'END max');
  return Math.max(0, 1 - absPressure(endMaxM, env) / absPressure(depthM, env));
}
