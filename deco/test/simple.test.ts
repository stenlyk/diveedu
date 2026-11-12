import { describe, expect, it } from 'vitest';
import { ascentMinutesMix, gradientPercent, ambientAt, ascentMinutesAir, ascentMinutesWithDecoGas, ceilingDepthN2, firstStopAir, gradientPercentN2, mValueN2, n2HalfTime, ndlMinutes, planDive } from '../src';
import { AIR } from '@diveedu/calc';

describe('zkratky deco', () => {
  it('poločasy a M-hodnoty podle čísla kompartmentu', () => {
    expect(n2HalfTime(1)).toBe(5);
    expect(n2HalfTime(16)).toBe(635);
    expect(mValueN2(1, 1)).toBeCloseTo(2.9624, 3); // 1,1696 + 1 / 0,5578
    expect(mValueN2(5, 4)).toBeCloseTo(0.62 + 4 / 0.8126, 10);
    expect(() => mValueN2(0, 1)).toThrow(/1–16/);
    expect(() => n2HalfTime(17)).toThrow(/1–16/);
    expect(() => n2HalfTime(2.5)).toThrow(/1–16/);
  });
  it('gradient factor: 0 % při okolním tlaku, 100 % na M-hodnotě', () => {
    expect(gradientPercentN2(3, 2, 2)).toBeCloseTo(0, 10);
    expect(gradientPercentN2(3, mValueN2(3, 2), 2)).toBeCloseTo(100, 10);
    expect(gradientPercentN2(3, (2 + mValueN2(3, 2)) / 2, 2)).toBeCloseTo(50, 10);
  });
  it('gradient factor z obecných hodnot', () => {
    expect(gradientPercent(2.5, 1.6, 2.6)).toBeCloseTo(90, 10);
    expect(gradientPercent(1.6, 1.6, 2.6)).toBe(0);
    expect(() => gradientPercent(2, 2, 2)).toThrow(/M-hodnota/);
  });
  it('strop kompartmentu', () => {
    // Kompartment 5 s 3,0 bar dusíku: při GF 100 je tolerovaný tlak (3 − 0,62) · 0,8126 = 1,934 bar → 9,3 m
    expect(ceilingDepthN2(5, 3, 100)).toBeCloseTo(9.34, 1);
    expect(ceilingDepthN2(5, 3, 50)).toBeGreaterThan(ceilingDepthN2(5, 3, 100));
    expect(ceilingDepthN2(5, 0.79, 100)).toBe(0);
    expect(() => ceilingDepthN2(5, 3, 0)).toThrow(/GF/);
  });
  it('bezdekompresní limit: nitrox déle než vzduch, konzervativnější GF kratší', () => {
    expect(ndlMinutes(30, 0.32, 100)).toBeGreaterThan(ndlMinutes(30, 0.21, 100));
    expect(ndlMinutes(30, 0.21, 70)).toBeLessThan(ndlMinutes(30, 0.21, 100));
  });
  it('výstup na libovolné směsi, s dekompresním plynem i bez', () => {
    expect(ascentMinutesMix(45, 30, 30, 85, 0.21, 0, 0, 0)).toBe(ascentMinutesAir(45, 30, 30, 85));
    expect(ascentMinutesMix(45, 30, 30, 85, 0.21, 0, 0.5, 21)).toBe(ascentMinutesWithDecoGas(45, 30, 30, 85, 0.5, 21));
    expect(ascentMinutesMix(60, 20, 50, 80, 0.18, 0.45, 0.5, 21)).toBeGreaterThan(10);
  });
  it('zkratky plánu odpovídají planDive', () => {
    const plan = planDive({ depthM: 45, bottomMinutes: 30, gases: [{ gas: AIR }], gfLow: 30, gfHigh: 85 });
    expect(ascentMinutesAir(45, 30, 30, 85)).toBe(plan.ascentMin);
    expect(firstStopAir(45, 30, 30, 85)).toBe(plan.firstStopM);
    expect(ascentMinutesWithDecoGas(45, 30, 30, 85, 0.5, 21)).toBeLessThan(plan.ascentMin);
    expect(ambientAt(30)).toBe(4);
  });
});
