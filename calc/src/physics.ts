import { assertFinite, assertNonNegative, assertPositive, CalcInputError } from './errors';
import { surfaceDensity } from './density';
import { DEFAULT_ENV, type Env } from './env';
import { AIR, type Gas } from './gas';
import { absPressure } from './pressure';

/** Hustota vzduchu v hloubce v g/l (zkratka pro numerické otázky). */
export function airDensity(depthM: number, env: Env = DEFAULT_ENV): number {
  return absPressure(depthM, env) * surfaceDensity(AIR);
}

/** Hustota mořské a sladké vody v kg/l. */
export const SEA_WATER_DENSITY = 1.03;
export const FRESH_WATER_DENSITY = 1.0;

/**
 * Výsledný vztlak v kg (Archimédův zákon): hmotnost vytlačené vody minus hmotnost tělesa.
 * Kladná hodnota = těleso stoupá, záporná = klesá.
 */
export function netBuoyancyKg(
  displacedLiters: number,
  massKg: number,
  waterDensityKgL: number = SEA_WATER_DENSITY,
): number {
  assertNonNegative(displacedLiters, 'vytlačený objem');
  assertNonNegative(massKg, 'hmotnost');
  assertPositive(waterDensityKgL, 'hustota vody');
  return displacedLiters * waterDensityKgL - massKg;
}

/** Hmotnost plynu v lahvi v kg (ideální plyn): objem lahve · tlak · hustota směsi na hladině. */
export function gasMassKg(tankLiters: number, pressureBar: number, gas: Gas = AIR): number {
  assertNonNegative(tankLiters, 'objem lahve');
  assertNonNegative(pressureBar, 'tlak');
  return (tankLiters * pressureBar * surfaceDensity(gas)) / 1000;
}

/**
 * Haldaneova rovnice: tlak inertního plynu v tkáni po čase t při stálém okolním tlaku.
 * p(t) = p_okolí + (p_0 − p_okolí) · 2^(−t / poločas)
 */
export function haldaneTissuePressure(
  initialBar: number,
  ambientInertBar: number,
  halfTimeMin: number,
  minutes: number,
): number {
  assertNonNegative(initialBar, 'počáteční tlak v tkáni');
  assertNonNegative(ambientInertBar, 'tlak inertního plynu');
  assertPositive(halfTimeMin, 'poločas');
  assertNonNegative(minutes, 'čas');
  return ambientInertBar + (initialBar - ambientInertBar) * Math.pow(2, -minutes / halfTimeMin);
}

/** Jak velkou část rozdílu tkáň vyrovná za daný čas (0–1). Po jednom poločasu 0,5. */
export function saturationFraction(halfTimeMin: number, minutes: number): number {
  assertPositive(halfTimeMin, 'poločas');
  assertNonNegative(minutes, 'čas');
  return 1 - Math.pow(2, -minutes / halfTimeMin);
}

const KELVIN_OFFSET = 273.15;

/**
 * Teplota plynu po rychlém (adiabatickém) stlačení z p1 na p2.
 * T2 = T1 · (p2 / p1)^((κ − 1) / κ); pro vzduch a kyslík κ ≈ 1,4.
 * Ideální horní mez – ve skutečnosti část tepla uteče do stěn.
 */
export function adiabaticTempC(temp1C: number, pressure1Bar: number, pressure2Bar: number, kappa = 1.4): number {
  assertFinite(temp1C, 'teplota');
  assertPositive(pressure1Bar, 'počáteční tlak');
  assertPositive(pressure2Bar, 'koncový tlak');
  if (temp1C <= -KELVIN_OFFSET) throw new CalcInputError('teplota musí být nad absolutní nulou');
  if (!(kappa > 1)) throw new CalcInputError('κ musí být větší než 1');
  return (temp1C + KELVIN_OFFSET) * Math.pow(pressure2Bar / pressure1Bar, (kappa - 1) / kappa) - KELVIN_OFFSET;
}
