/** Výpočty pro prostředí se stropem: dosah, návrat a tlak otočky při různých rychlostech tam a zpět. */
import { litersToBar, gasConsumed } from './consumption';
import { assertNonNegative, assertPositive } from './errors';

/** Doba, na kterou vystačí daný úbytek tlaku v hloubce (min). */
export function minutesOnGas(usableBar: number, tankLiters: number, sacLpm: number, depthM: number): number {
  assertNonNegative(usableBar, 'použitelný tlak');
  assertPositive(sacLpm, 'SAC');
  return usableBar / litersToBar(gasConsumed(sacLpm, depthM, 1), tankLiters);
}

/** Dosah průniku v metrech: jak daleko doplaveš na daný úbytek tlaku při dané rychlosti. */
export function penetrationDistance(usableBar: number, tankLiters: number, sacLpm: number, depthM: number, speedMpm: number): number {
  assertNonNegative(speedMpm, 'rychlost');
  return minutesOnGas(usableBar, tankLiters, sacLpm, depthM) * speedMpm;
}

/** Doba návratu z dané vzdálenosti při dané rychlosti (min). */
export function exitMinutes(distanceM: number, speedMpm: number): number {
  assertNonNegative(distanceM, 'vzdálenost');
  assertPositive(speedMpm, 'rychlost');
  return distanceM / speedMpm;
}

/** Plyn na cestu ven v barech pro daný počet potápěčů dýchajících z jedné zásoby. */
export function exitGasBar(distanceM: number, speedMpm: number, sacLpm: number, depthM: number, tankLiters: number, divers = 2): number {
  assertPositive(divers, 'počet potápěčů');
  return litersToBar(divers * gasConsumed(sacLpm, depthM, exitMinutes(distanceM, speedMpm)), tankLiters);
}

/**
 * Podíl plynu použitelný na cestu dovnitř, když se rychlost tam a zpět liší
 * (proud, skútr, tažení partnera). Podmínka: po otočce musí zbýt plyn na cestu ven pro dva.
 * Pro stejné rychlosti vychází třetina; víc než třetina se nepoužije nikdy.
 */
export function usableFraction(speedInMpm: number, speedOutMpm: number): number {
  assertPositive(speedInMpm, 'rychlost dovnitř');
  assertPositive(speedOutMpm, 'rychlost ven');
  const ratio = speedInMpm / speedOutMpm; // kolikrát déle trvá cesta ven
  return Math.min(1 / 3, 1 / (1 + 2 * ratio));
}

/** Tlak otočky pro různé rychlosti tam a zpět. */
export function turnPressureForSpeeds(startBar: number, speedInMpm: number, speedOutMpm: number): number {
  assertNonNegative(startBar, 'počáteční tlak');
  return startBar * (1 - usableFraction(speedInMpm, speedOutMpm));
}
