import { describe, expect, it } from 'vitest';
import {
  AIR,
  CalcInputError,
  checkMix,
  densityRating,
  ead,
  EAN32,
  EAN50,
  end,
  FRESH_WATER_ENV,
  gasDensity,
  HELIUM,
  icdCheck,
  nitrox,
  optimalTrimix,
  OXYGEN,
  partialPressureBlend,
  ppN2,
  practicalTrimix,
  surfaceDensity,
  topUp,
  trimix,
} from '../src';

describe('ppN2', () => {
  it('vzduch ve 40 m = 3,95 bar', () => {
    expect(ppN2(AIR, 40)).toBeCloseTo(3.95, 10);
    expect(ppN2(AIR, 41.2, FRESH_WATER_ENV)).toBeCloseTo(3.95, 10);
  });
});

describe('EAD', () => {
  it('vzduch má EAD rovnou hloubce', () => {
    expect(ead(0.21, 40)).toBeCloseTo(40, 10);
  });
  it('EAN36 ve 28 m = 20,8 m', () => {
    // 0,64 / 0,79 · 38 − 10 = 20,78
    expect(ead(0.36, 28)).toBeCloseTo(20.78, 2);
  });
  it('nikdy záporná: EAN80 na 3 m i čistý kyslík', () => {
    expect(ead(0.8, 3)).toBe(0);
    expect(ead(1, 6)).toBe(0);
  });
  it('sladká voda a neplatná frakce', () => {
    expect(ead(0.21, 20.6, FRESH_WATER_ENV)).toBeCloseTo(20.6, 10);
    expect(() => ead(1.5, 10)).toThrow(CalcInputError);
  });
});

describe('END', () => {
  it('O2 nenarkotický: Tx 18/45 v 60 m = 22,8 m', () => {
    // 0,37 / 0,79 · 70 − 10 = 22,78
    expect(end(trimix(18, 45), 60, { o2Narcotic: false })).toBeCloseTo(22.78, 2);
  });
  it('vzduch: obě varianty vrací hloubku ponoru', () => {
    expect(end(AIR, 30)).toBeCloseTo(30, 10);
    expect(end(AIR, 30, { o2Narcotic: false })).toBeCloseTo(30, 10);
  });
  it('nitrox při narkotickém O2 nepomáhá, při nenarkotickém ano', () => {
    expect(end(EAN32, 30, { o2Narcotic: true })).toBeCloseTo(30, 10);
    expect(end(EAN32, 30, { o2Narcotic: false })).toBeCloseTo(24.43, 2);
  });
  it('nikdy záporná: heliox a čisté helium', () => {
    expect(end(trimix(10, 90), 100, { o2Narcotic: false })).toBe(0);
    expect(end(HELIUM, 100)).toBe(0);
    expect(end(trimix(5, 95), 10)).toBe(0);
  });
  it('sladká voda', () => {
    expect(end(AIR, 30.9, {}, FRESH_WATER_ENV)).toBeCloseTo(30.9, 10);
  });
});

describe('hustota plynu', () => {
  it('hustoty na hladině: vzduch 1,288, kyslík 1,429, helium 0,179 g/l', () => {
    expect(surfaceDensity(AIR)).toBeCloseTo(1.288, 3);
    expect(surfaceDensity(OXYGEN)).toBeCloseTo(1.429, 10);
    expect(surfaceDensity(HELIUM)).toBeCloseTo(0.179, 10);
  });
  it('vzduch ve 40 m = 6,44 g/l (nad tvrdým limitem)', () => {
    expect(gasDensity(AIR, 40)).toBeCloseTo(6.44, 2);
    expect(gasDensity(AIR, 41.2, FRESH_WATER_ENV)).toBeCloseTo(6.44, 2);
  });
  it('hodnocení podle limitů 5,2 a 6,2 g/l', () => {
    expect(densityRating(5.15)).toBe('ok');
    expect(densityRating(5.2)).toBe('ok');
    expect(densityRating(5.6)).toBe('warning');
    expect(densityRating(6.2)).toBe('warning');
    expect(densityRating(6.44)).toBe('limit');
    expect(() => densityRating(-1)).toThrow(CalcInputError);
  });
});

describe('optimální trimix', () => {
  it('60 m, ppO2 1,4, END 30 m → 20/42,9 (limituje END)', () => {
    const result = optimalTrimix({ depthM: 60, ppO2MaxBar: 1.4, endMaxM: 30 });
    expect(result.gas.fO2).toBeCloseTo(0.2, 10);
    expect(result.gas.fHe).toBeCloseTo(1 - 4 / 7, 10);
    expect(result.feasible).toBe(true);
    expect(result.limitedBy).toBe('end');
  });
  it('O2 nenarkotický potřebuje méně helia', () => {
    const result = optimalTrimix({ depthM: 60, ppO2MaxBar: 1.4, endMaxM: 30, o2Narcotic: false });
    // 1 − 0,2 − 0,79 · 4/7 = 0,3486
    expect(result.gas.fHe).toBeCloseTo(0.3486, 4);
    expect(result.limitedBy).toBe('end');
  });
  it('mělký ponor nepotřebuje helium', () => {
    const result = optimalTrimix({ depthM: 25, ppO2MaxBar: 1.4, endMaxM: 30 });
    expect(result.gas.fO2).toBeCloseTo(0.4, 10);
    expect(result.gas.fHe).toBe(0);
    expect(result.limitedBy).toBe('none');
    expect(result.feasible).toBe(true);
  });
  it('limit hustoty může určit helium místo END', () => {
    // 60 m, fO2 0,2: END 40 m → fHe 0,2857; hustota 5,2 g/l → fHe 0,5075
    const result = optimalTrimix({ depthM: 60, ppO2MaxBar: 1.4, endMaxM: 40, densityMaxGL: 5.2 });
    expect(result.limitedBy).toBe('density');
    expect(result.gas.fHe).toBeCloseTo(0.5075, 3);
    expect(gasDensity(result.gas, 60)).toBeCloseTo(5.2, 6);
  });
  it('volný limit hustoty nic nemění', () => {
    const result = optimalTrimix({ depthM: 60, ppO2MaxBar: 1.4, endMaxM: 30, densityMaxGL: 9 });
    expect(result.limitedBy).toBe('end');
  });
  it('nesplnitelné limity označí feasible = false', () => {
    const result = optimalTrimix({ depthM: 60, ppO2MaxBar: 1.4, endMaxM: 0 });
    expect(result.feasible).toBe(false);
    expect(result.gas.fO2 + result.gas.fHe).toBeCloseTo(1, 10);
  });
  it('sladká voda a neplatné vstupy', () => {
    expect(
      optimalTrimix({ depthM: 61.8, ppO2MaxBar: 1.4, endMaxM: 30.9 }, FRESH_WATER_ENV).gas.fO2,
    ).toBeCloseTo(0.2, 10);
    expect(() => optimalTrimix({ depthM: 60, ppO2MaxBar: 0, endMaxM: 30 })).toThrow(CalcInputError);
    expect(() => optimalTrimix({ depthM: 60, ppO2MaxBar: 1.4, endMaxM: -1 })).toThrow(CalcInputError);
    expect(() =>
      optimalTrimix({ depthM: 60, ppO2MaxBar: 1.4, endMaxM: 30, densityMaxGL: 0 }),
    ).toThrow(CalcInputError);
  });
  it('praktické zaokrouhlení: kyslík dolů, helium nahoru', () => {
    expect(practicalTrimix({ fO2: 0.2, fHe: 1 - 4 / 7 })).toEqual({ fO2: 0.2, fHe: 0.43 });
    expect(practicalTrimix({ fO2: 0.189, fHe: 0.441 })).toEqual({ fO2: 0.18, fHe: 0.45 });
    expect(practicalTrimix({ fO2: 0.18, fHe: 0.45 })).toEqual({ fO2: 0.18, fHe: 0.45 });
    expect(practicalTrimix({ fO2: 0.105, fHe: 0.895 })).toEqual({ fO2: 0.1, fHe: 0.9 });
  });
});

describe('kontrola směsi proti limitům', () => {
  const limits = { ppO2MinBar: 0.18, ppO2MaxBar: 1.4, endMaxM: 30, densityMaxGL: 6.2 };
  it('Tx 18/45 v 60 m projde', () => {
    const check = checkMix(trimix(18, 45), 60, limits);
    expect(check.allowed).toBe(true);
    expect(check.ppO2Bar).toBeCloseTo(1.26, 10);
    expect(check.endM).toBeCloseTo(28.5, 10);
    expect(check.densityGL).toBeCloseTo(5.6, 2);
  });
  it('vzduch v 60 m: vysoké ppO2, END i hustota', () => {
    const check = checkMix(AIR, 60, limits);
    expect(check).toMatchObject({
      ppO2TooHigh: true,
      endTooDeep: true,
      tooDense: true,
      hypoxic: false,
      allowed: false,
    });
  });
  it('Tx 10/70 na hladině je hypoxický', () => {
    const check = checkMix(trimix(10, 70), 0, limits);
    expect(check.hypoxic).toBe(true);
    expect(check.allowed).toBe(false);
  });
  it('varianta s nenarkotickým O2 a sladkou vodou', () => {
    const check = checkMix(EAN32, 30.9, { ...limits, endMaxM: 26, o2Narcotic: false }, FRESH_WATER_ENV);
    expect(check.endM).toBeCloseTo(25.16, 1);
    expect(check.allowed).toBe(true);
  });
});

describe('míchání parciálním tlakem', () => {
  it('EAN32 do prázdné lahve na 200 bar: 27,8 bar O2 + vzduch', () => {
    const blend = partialPressureBlend({ startBar: 0, targetBar: 200, targetGas: EAN32 });
    expect(blend.o2Bar).toBeCloseTo(27.85, 2);
    expect(blend.topBar).toBeCloseTo(172.15, 2);
    expect(blend.heBar).toBe(0);
    expect(blend.afterO2Bar).toBeCloseTo(27.85, 2);
    expect(blend.feasible).toBe(true);
  });
  it('Tx 18/45 do prázdné lahve: 90 bar He, 16,3 bar O2, 93,7 bar vzduchu', () => {
    const blend = partialPressureBlend({ startBar: 0, targetBar: 200, targetGas: trimix(18, 45) });
    expect(blend.heBar).toBeCloseTo(90, 8);
    expect(blend.o2Bar).toBeCloseTo(16.33, 2);
    expect(blend.topBar).toBeCloseTo(93.67, 2);
    expect(blend.afterHeBar).toBeCloseTo(90, 8);
    expect(blend.afterO2Bar).toBeCloseTo(106.33, 2);
    expect(blend.heBar + blend.o2Bar + blend.topBar).toBeCloseTo(200, 8);
  });
  it('doplnění zbytku 50 bar EAN32 zpět na 200 bar EAN32', () => {
    const blend = partialPressureBlend({
      startBar: 50,
      startGas: EAN32,
      targetBar: 200,
      targetGas: EAN32,
    });
    expect(blend.o2Bar).toBeCloseTo(20.89, 2);
    expect(blend.topBar).toBeCloseTo(129.11, 2);
    expect(blend.feasible).toBe(true);
  });
  it('zbytek s příliš mnoho dusíku → nelze bez upuštění', () => {
    const blend = partialPressureBlend({
      startBar: 100,
      startGas: AIR,
      targetBar: 110,
      targetGas: EAN32,
    });
    expect(blend.feasible).toBe(false);
  });
  it('zbytek s příliš mnoho helia → nelze', () => {
    const blend = partialPressureBlend({
      startBar: 100,
      startGas: trimix(18, 45),
      targetBar: 200,
      targetGas: EAN32,
    });
    expect(blend.feasible).toBe(false);
  });
  it('doplňování kyslíkem (plyn bez dusíku): heliox ano, nitrox ne', () => {
    const heliox = partialPressureBlend({
      startBar: 0,
      targetBar: 200,
      targetGas: trimix(20, 80),
      topGas: OXYGEN,
    });
    expect(heliox.feasible).toBe(true);
    expect(heliox.heBar).toBeCloseTo(160, 8);
    expect(heliox.o2Bar).toBeCloseTo(40, 8);
    expect(heliox.topBar).toBe(0);
    const nitroxBlend = partialPressureBlend({
      startBar: 0,
      targetBar: 200,
      targetGas: EAN32,
      topGas: OXYGEN,
    });
    expect(nitroxBlend.feasible).toBe(false);
  });
  it('odmítne cílový tlak pod zbytkem a neplatné vstupy', () => {
    expect(() =>
      partialPressureBlend({ startBar: 210, targetBar: 200, targetGas: EAN32 }),
    ).toThrow(/vyšší/);
    expect(() => partialPressureBlend({ startBar: -1, targetBar: 200, targetGas: EAN32 })).toThrow(
      CalcInputError,
    );
    expect(() => partialPressureBlend({ startBar: 0, targetBar: 0, targetGas: EAN32 })).toThrow(
      CalcInputError,
    );
  });
});

describe('doplnění lahve', () => {
  it('100 bar EAN50 doplněno vzduchem na 200 bar = EAN35,5', () => {
    const gas = topUp({ startBar: 100, startGas: EAN50, endBar: 200 });
    expect(gas.fO2).toBeCloseTo(0.355, 10);
    expect(gas.fHe).toBe(0);
  });
  it('50 bar Tx 18/45 doplněno EAN32 na 200 bar', () => {
    const gas = topUp({ startBar: 50, startGas: trimix(18, 45), endBar: 200, topGas: nitrox(32) });
    expect(gas.fO2).toBeCloseTo(0.285, 10);
    expect(gas.fHe).toBeCloseTo(0.1125, 10);
  });
  it('odmítne pokles tlaku', () => {
    expect(() => topUp({ startBar: 200, startGas: AIR, endBar: 100 })).toThrow(/vyšší/);
    expect(() => topUp({ startBar: 0, startGas: AIR, endBar: 0 })).toThrow(CalcInputError);
    expect(() => topUp({ startBar: -5, startGas: AIR, endBar: 10 })).toThrow(CalcInputError);
  });
});

describe('ICD – pravidlo pětin', () => {
  it('Tx 18/45 → EAN50: dusík +0,13, helium −0,45, limit 0,09 → varování', () => {
    const check = icdCheck(trimix(18, 45), EAN50);
    expect(check.deltaN2).toBeCloseTo(0.13, 10);
    expect(check.deltaHe).toBeCloseTo(-0.45, 10);
    expect(check.maxN2Increase).toBeCloseTo(0.09, 10);
    expect(check.ok).toBe(false);
  });
  it('Tx 18/45 → Tx 50/25: dusíku ubylo → v pořádku', () => {
    expect(icdCheck(trimix(18, 45), trimix(50, 25)).ok).toBe(true);
  });
  it('Tx 21/35 → EAN50: dusík +0,06 ≤ 0,07 → v pořádku', () => {
    expect(icdCheck(trimix(21, 35), EAN50).ok).toBe(true);
  });
  it('bez poklesu helia se pravidlo neuplatní', () => {
    expect(icdCheck(EAN50, AIR).ok).toBe(true);
    expect(icdCheck(AIR, trimix(18, 45)).ok).toBe(true);
  });
});
