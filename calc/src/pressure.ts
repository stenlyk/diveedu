import { assertFinite, assertNonNegative, assertPositive, CalcInputError } from './errors';
import { DEFAULT_ENV, type Env, validateEnv } from './env';

/** Absolutní (okolní) tlak v barech v dané hloubce. P_abs = d / 10 + 1 */
export function absPressure(depthM: number, env: Env = DEFAULT_ENV): number {
  assertNonNegative(depthM, 'hloubka');
  validateEnv(env);
  return depthM / env.metersPerBar + env.surfaceBar;
}

/**
 * Hloubka v metrech odpovídající absolutnímu tlaku. Inverze k absPressure.
 * Pro tlak nižší než hladinový vrací zápornou hodnotu (volající rozhodne, co s ní).
 */
export function depthFromPressure(pAbsBar: number, env: Env = DEFAULT_ENV): number {
  assertPositive(pAbsBar, 'absolutní tlak');
  validateEnv(env);
  return (pAbsBar - env.surfaceBar) * env.metersPerBar;
}

/** Boyleův zákon: objem plynu po přesunu z hloubky d1 do d2. V2 = V1 · P1 / P2 */
export function boyleVolume(
  volume1L: number,
  depth1M: number,
  depth2M: number,
  env: Env = DEFAULT_ENV,
): number {
  assertNonNegative(volume1L, 'objem');
  return (volume1L * absPressure(depth1M, env)) / absPressure(depth2M, env);
}

const KELVIN_OFFSET = 273.15;

/** Gay-Lussacův zákon: tlak v lahvi po změně teploty. P2 = P1 · T2 / T1 (T v kelvinech) */
export function gayLussacPressure(pressure1Bar: number, temp1C: number, temp2C: number): number {
  assertNonNegative(pressure1Bar, 'tlak');
  assertFinite(temp1C, 'teplota 1');
  assertFinite(temp2C, 'teplota 2');
  if (temp1C <= -KELVIN_OFFSET || temp2C <= -KELVIN_OFFSET) {
    throw new CalcInputError('teplota musí být nad absolutní nulou');
  }
  return (pressure1Bar * (temp2C + KELVIN_OFFSET)) / (temp1C + KELVIN_OFFSET);
}

/** Kolikrát vzroste absolutní tlak při přesunu z hloubky d1 do d2. */
export function pressureRatio(depth1M: number, depth2M: number, env: Env = DEFAULT_ENV): number {
  return absPressure(depth2M, env) / absPressure(depth1M, env);
}
