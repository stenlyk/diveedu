/** Neplatný vstup výpočtu (frakce mimo 0–1, záporná hloubka, NaN…). */
export class CalcInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalcInputError';
  }
}

export function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new CalcInputError(`${name} musí být konečné číslo`);
}

export function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) throw new CalcInputError(`${name} nesmí být záporné`);
}

export function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (value <= 0) throw new CalcInputError(`${name} musí být kladné`);
}

/** Frakce v intervalu <0, 1>. */
export function assertFraction(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0 || value > 1) throw new CalcInputError(`${name} musí být v rozsahu 0–1`);
}

/** Frakce v intervalu (0, 1>. */
export function assertPositiveFraction(value: number, name: string): void {
  assertFraction(value, name);
  if (value === 0) throw new CalcInputError(`${name} musí být větší než 0`);
}
