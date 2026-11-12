import { fN2, type Gas } from './gas';

const EPS = 1e-9;

export interface IcdCheck {
  /** Změna frakce dusíku při přepnutí (kladná = dusíku přibylo). */
  deltaN2: number;
  /** Změna frakce helia (záporná = helia ubylo). */
  deltaHe: number;
  /** Nejvyšší přípustný nárůst dusíku podle pravidla pětin. */
  maxN2Increase: number;
  ok: boolean;
}

/**
 * Kontrola izobarické protidifuze (ICD) při přepnutí plynu pravidlem pětin:
 * nárůst frakce dusíku nemá překročit 1/5 poklesu frakce helia.
 * Je to provozní konvence, ne fyzikální zákon.
 */
export function icdCheck(from: Gas, to: Gas): IcdCheck {
  const deltaN2 = fN2(to) - fN2(from);
  const deltaHe = to.fHe - from.fHe;
  const heDrop = Math.max(0, -deltaHe);
  const maxN2Increase = heDrop / 5;
  // Bez poklesu helia nejde o přepnutí He → N2 a pravidlo se neuplatní.
  const ok = heDrop <= EPS || deltaN2 <= maxN2Increase + EPS;
  return { deltaN2, deltaHe, maxN2Increase, ok };
}

/** Nárůst frakce dusíku při přepnutí mezi směsmi zadanými frakcemi (kladný = dusíku přibylo). */
export function icdN2Rise(fromFO2: number, fromFHe: number, toFO2: number, toFHe: number): number {
  return icdCheck({ fO2: fromFO2, fHe: fromFHe }, { fO2: toFO2, fHe: toFHe }).deltaN2;
}

/** Nejvyšší přípustný nárůst frakce dusíku podle pravidla pětin: pětina poklesu frakce helia. */
export function icdAllowedN2Rise(fromFHe: number, toFHe: number): number {
  return icdCheck({ fO2: 0, fHe: fromFHe }, { fO2: 0, fHe: toFHe }).maxN2Increase;
}
