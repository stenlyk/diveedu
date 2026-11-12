import { assertNonNegative } from './errors';
import { DEFAULT_ENV, type Env } from './env';
import { fN2, type Gas } from './gas';
import { absPressure } from './pressure';

/** Hustoty čistých plynů v g/l při 1 bar a 0 °C. */
export const DENSITY_O2 = 1.429;
export const DENSITY_N2 = 1.251;
export const DENSITY_HE = 0.179;

/** Doporučený a tvrdý limit hustoty dýchaného plynu (Anthony & Mitchell, 2016). */
export const DENSITY_RECOMMENDED_GL = 5.2;
export const DENSITY_HARD_LIMIT_GL = 6.2;

/** Hustota směsi na hladině (1 bar) v g/l. */
export function surfaceDensity(gas: Gas): number {
  return DENSITY_O2 * gas.fO2 + DENSITY_N2 * fN2(gas) + DENSITY_HE * gas.fHe;
}

/** Hustota dýchaného plynu v hloubce. ρ = P_abs · (1,429·fO2 + 1,251·fN2 + 0,179·fHe) [g/l] */
export function gasDensity(gas: Gas, depthM: number, env: Env = DEFAULT_ENV): number {
  return absPressure(depthM, env) * surfaceDensity(gas);
}

export type DensityRating = 'ok' | 'warning' | 'limit';

/** ok ≤ 5,2 g/l; warning ≤ 6,2 g/l; limit nad 6,2 g/l. */
export function densityRating(densityGL: number): DensityRating {
  assertNonNegative(densityGL, 'hustota');
  if (densityGL <= DENSITY_RECOMMENDED_GL) return 'ok';
  if (densityGL <= DENSITY_HARD_LIMIT_GL) return 'warning';
  return 'limit';
}
