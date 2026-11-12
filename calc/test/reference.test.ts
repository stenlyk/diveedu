/**
 * Referenční hodnoty ze SPEC.md (sekce „Referenční hodnoty pro jednotkové testy“).
 * Všechny přepočítány ručně. Hustota vzduchu ve 30 m je 5,15 g/l dle vzorce
 * (SPEC uváděl 5,17 pro reálný vzduch s argonem; rozhodnutí viz PLAN.md §4).
 */
import { describe, expect, it } from 'vitest';
import { AIR, bestMix, ead, end, gasDensity, mod, otu, trimix } from '../src';

describe('referenční hodnoty SPEC', () => {
  it('MOD EAN32 při ppO2 1,4 = 33,75 m', () => {
    expect(mod(0.32, 1.4)).toBeCloseTo(33.75, 10);
  });
  it('MOD vzduch při ppO2 1,4 = 56,7 m', () => {
    expect(mod(0.21, 1.4)).toBeCloseTo(56.67, 2);
  });
  it('EAD EAN32 ve 30 m = 24,4 m', () => {
    expect(ead(0.32, 30)).toBeCloseTo(24.43, 2);
  });
  it('END (O2 narkotický) Tx 18/45 v 60 m = 28,5 m', () => {
    expect(end(trimix(18, 45), 60)).toBeCloseTo(28.5, 10);
  });
  it('hustota vzduchu ve 30 m = 5,15 g/l', () => {
    expect(gasDensity(AIR, 30)).toBeCloseTo(5.15, 2);
  });
  it('hustota Tx 18/45 v 60 m = 5,60 g/l', () => {
    expect(gasDensity(trimix(18, 45), 60)).toBeCloseTo(5.6, 2);
  });
  it('best mix pro 40 m při ppO2 1,4 = 0,28', () => {
    expect(bestMix(40, 1.4)).toBeCloseTo(0.28, 10);
  });
  it('OTU při ppO2 1,4 za 30 min = 48,9', () => {
    expect(otu(1.4, 30)).toBeCloseTo(48.9, 1);
  });
});
