import { assertFinite, assertPositive } from './errors';

const EPS = 1e-9;

/** Zaokrouhlení dolů na násobek kroku (např. MOD na celé metry). */
export function floorTo(value: number, step = 1): number {
  assertFinite(value, 'hodnota');
  assertPositive(step, 'krok');
  return Math.floor(value / step + EPS) * step;
}

/** Zaokrouhlení nahoru na násobek kroku (např. spotřeba, rock bottom). */
export function ceilTo(value: number, step = 1): number {
  assertFinite(value, 'hodnota');
  assertPositive(step, 'krok');
  return Math.ceil(value / step - EPS) * step;
}

/** Matematické zaokrouhlení na daný počet desetinných míst. */
export function roundTo(value: number, decimals = 0): number {
  assertFinite(value, 'hodnota');
  const factor = 10 ** decimals;
  return Math.round(value * factor + Math.sign(value) * EPS) / factor;
}

/** České formátování čísla s desetinnou čárkou. */
export function formatCs(value: number, decimals = 0): string {
  return roundTo(value, decimals).toFixed(decimals).replace('.', ',').replace(/^-(0(,0+)?)$/, '$1');
}

/** Načte číslo zadané s desetinnou čárkou i tečkou; neplatný vstup vrací null. */
export function parseCs(text: string): number | null {
  const normalized = text.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}
