import { assertFraction, CalcInputError } from './errors';

/** Dýchací směs zadaná frakcemi kyslíku a helia; zbytek je dusík. */
export interface Gas {
  fO2: number;
  fHe: number;
}

/** Frakce dusíku ve vzduchu použitá ve vzorcích EAD/END (konvence). */
export const AIR_FN2 = 0.79;

const EPS = 1e-9;

export function validateGas(gas: Gas): void {
  assertFraction(gas.fO2, 'fO2');
  assertFraction(gas.fHe, 'fHe');
  if (gas.fO2 + gas.fHe > 1 + EPS) {
    throw new CalcInputError('součet fO2 a fHe nesmí být větší než 1');
  }
}

/** Frakce dusíku směsi (nikdy záporná kvůli zaokrouhlení). */
export function fN2(gas: Gas): number {
  validateGas(gas);
  return Math.max(0, 1 - gas.fO2 - gas.fHe);
}

export function nitrox(o2Percent: number): Gas {
  const gas = { fO2: o2Percent / 100, fHe: 0 };
  validateGas(gas);
  return gas;
}

export function trimix(o2Percent: number, hePercent: number): Gas {
  const gas = { fO2: o2Percent / 100, fHe: hePercent / 100 };
  validateGas(gas);
  return gas;
}

export const AIR: Gas = Object.freeze({ fO2: 0.21, fHe: 0 });
export const EAN32: Gas = Object.freeze({ fO2: 0.32, fHe: 0 });
export const EAN50: Gas = Object.freeze({ fO2: 0.5, fHe: 0 });
export const OXYGEN: Gas = Object.freeze({ fO2: 1, fHe: 0 });
export const HELIUM: Gas = Object.freeze({ fO2: 0, fHe: 1 });

/** Český název směsi: „vzduch“, „EAN32“, „kyslík“, „Tx 18/45“. */
export function gasLabel(gas: Gas): string {
  validateGas(gas);
  const o2 = Math.round(gas.fO2 * 100);
  const he = Math.round(gas.fHe * 100);
  if (he > 0) return `Tx ${o2}/${he}`;
  if (o2 === 21) return 'vzduch';
  if (o2 === 100) return 'kyslík';
  return `EAN${o2}`;
}
