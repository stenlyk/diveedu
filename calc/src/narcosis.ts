import { assertFraction } from './errors';
import { DEFAULT_ENV, type Env } from './env';
import { AIR_FN2, fN2, type Gas } from './gas';
import { absPressure, depthFromPressure } from './pressure';

/** Parciální tlak dusíku v barech. */
export function ppN2(gas: Gas, depthM: number, env: Env = DEFAULT_ENV): number {
  return fN2(gas) * absPressure(depthM, env);
}

/**
 * Ekvivalentní vzduchová hloubka nitroxu. EAD = (1 − fO2) / 0,79 · (d + 10) − 10
 * Nikdy nevrací zápornou hloubku.
 */
export function ead(fO2: number, depthM: number, env: Env = DEFAULT_ENV): number {
  assertFraction(fO2, 'fO2');
  const pAir = ((1 - fO2) / AIR_FN2) * absPressure(depthM, env);
  return pAir <= 0 ? 0 : Math.max(0, depthFromPressure(pAir, env));
}

export interface EndOptions {
  /**
   * true (výchozí): kyslík se počítá jako stejně narkotický jako dusík
   *   END = (1 − fHe) · (d + 10) − 10
   * false: narkotický je jen dusík
   *   END = fN2 / 0,79 · (d + 10) − 10
   */
  o2Narcotic?: boolean;
}

/** Ekvivalentní narkotická hloubka trimixu. Nikdy nevrací zápornou hloubku. */
export function end(
  gas: Gas,
  depthM: number,
  options: EndOptions = {},
  env: Env = DEFAULT_ENV,
): number {
  const o2Narcotic = options.o2Narcotic ?? true;
  const narcoticFraction = o2Narcotic ? fN2(gas) + gas.fO2 : fN2(gas) / AIR_FN2;
  const pNarcotic = narcoticFraction * absPressure(depthM, env);
  return pNarcotic <= 0 ? 0 : Math.max(0, depthFromPressure(pNarcotic, env));
}
