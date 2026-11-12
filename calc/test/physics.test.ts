import { describe, expect, it } from 'vitest';
import {
  adiabaticTempC,
  airDensity,
  boyleSteps,
  boyleVolume,
  CalcInputError,
  cnsPercent,
  cnsSteps,
  EAN32,
  FRESH_WATER_DENSITY,
  FRESH_WATER_ENV,
  gasMassKg,
  haldaneTissuePressure,
  netBuoyancyKg,
  nitroxBlendSteps,
  saturationFraction,
} from '../src';

describe('hustota vzduchu', () => {
  it('30 m = 5,15 g/l; 40 m = 6,44 g/l', () => {
    expect(airDensity(30)).toBeCloseTo(5.15, 2);
    expect(airDensity(40)).toBeCloseTo(6.44, 2);
    expect(airDensity(30.9, FRESH_WATER_ENV)).toBeCloseTo(5.15, 2);
  });
});

describe('vztlak', () => {
  it('těleso 10 l o hmotnosti 12 kg v moři klesá silou 1,7 kg', () => {
    expect(netBuoyancyKg(10, 12)).toBeCloseTo(-1.7, 10);
  });
  it('ve sladké vodě nese méně', () => {
    expect(netBuoyancyKg(10, 12, FRESH_WATER_DENSITY)).toBeCloseTo(-2, 10);
    expect(netBuoyancyKg(100, 95)).toBeCloseTo(8, 10);
  });
  it('odmítne neplatné vstupy', () => {
    expect(() => netBuoyancyKg(-1, 1)).toThrow(CalcInputError);
    expect(() => netBuoyancyKg(1, -1)).toThrow(CalcInputError);
    expect(() => netBuoyancyKg(1, 1, 0)).toThrow(CalcInputError);
  });
  it('vzduch ve dvojčeti 2×12 l při 200 bar váží 6,2 kg', () => {
    // 24 · 200 · 1,288 / 1000 = 6,18
    expect(gasMassKg(24, 200)).toBeCloseTo(6.18, 2);
    expect(gasMassKg(12, 200, EAN32)).toBeCloseTo(3.14, 2);
    expect(() => gasMassKg(-1, 200)).toThrow(CalcInputError);
    expect(() => gasMassKg(12, -1)).toThrow(CalcInputError);
  });
});

describe('Haldane', () => {
  it('po jednom poločasu je tkáň v polovině cesty, po dvou ve třech čtvrtinách', () => {
    expect(haldaneTissuePressure(0.79, 3.16, 20, 20)).toBeCloseTo(1.975, 10);
    expect(haldaneTissuePressure(0.79, 3.16, 20, 40)).toBeCloseTo(2.5675, 10);
    expect(haldaneTissuePressure(0.79, 3.16, 20, 0)).toBeCloseTo(0.79, 10);
  });
  it('funguje i pro vysycování', () => {
    expect(haldaneTissuePressure(3.16, 0.79, 10, 10)).toBeCloseTo(1.975, 10);
  });
  it('podíl nasycení: 50 %, 75 %, po šesti poločasech přes 98 %', () => {
    expect(saturationFraction(20, 20)).toBeCloseTo(0.5, 10);
    expect(saturationFraction(20, 40)).toBeCloseTo(0.75, 10);
    expect(saturationFraction(5, 30)).toBeCloseTo(0.984, 3);
  });
  it('odmítne neplatné vstupy', () => {
    expect(() => haldaneTissuePressure(-1, 1, 5, 5)).toThrow(CalcInputError);
    expect(() => haldaneTissuePressure(1, -1, 5, 5)).toThrow(CalcInputError);
    expect(() => haldaneTissuePressure(1, 1, 0, 5)).toThrow(CalcInputError);
    expect(() => haldaneTissuePressure(1, 1, 5, -5)).toThrow(CalcInputError);
    expect(() => saturationFraction(0, 5)).toThrow(CalcInputError);
    expect(() => saturationFraction(5, -1)).toThrow(CalcInputError);
  });
});

describe('adiabatické stlačení', () => {
  it('z 1 na 200 bar při 20 °C vychází přes 1000 °C', () => {
    // 293,15 · 200^(0,4/1,4) − 273,15 = 293,15 · 4,544 − 273,15 ≈ 1059
    expect(adiabaticTempC(20, 1, 200)).toBeCloseTo(1059, -1);
  });
  it('bez změny tlaku se teplota nemění', () => {
    expect(adiabaticTempC(20, 50, 50)).toBeCloseTo(20, 10);
  });
  it('jiné κ a neplatné vstupy', () => {
    expect(adiabaticTempC(20, 1, 200, 1.66)).toBeGreaterThan(adiabaticTempC(20, 1, 200));
    expect(() => adiabaticTempC(-300, 1, 2)).toThrow(/absolutní nulou/);
    expect(() => adiabaticTempC(20, 0, 2)).toThrow(CalcInputError);
    expect(() => adiabaticTempC(20, 1, 0)).toThrow(CalcInputError);
    expect(() => adiabaticTempC(20, 1, 2, 1)).toThrow(/κ/);
    expect(() => adiabaticTempC(NaN, 1, 2)).toThrow(CalcInputError);
  });
});

describe('další rozepsané postupy', () => {
  it('Boyle', () => {
    const steps = boyleSteps(6, 20, 0);
    expect(steps.map((s) => s.value)).toEqual([3, 1, boyleVolume(6, 20, 0)]);
  });
  it('CNS', () => {
    const steps = cnsSteps(1.4, 30);
    expect(steps[0]!.value).toBeCloseTo(150, 8);
    expect(steps[1]!.value).toBeCloseTo(cnsPercent(1.4, 30)!, 10);
  });
  it('CNS mimo tabulku nebo pod prahem nejde rozepsat', () => {
    expect(() => cnsSteps(1.8, 10)).toThrow(CalcInputError);
    expect(() => cnsSteps(0.4, 10)).toThrow(CalcInputError);
  });
  it('míchání nitroxu', () => {
    const steps = nitroxBlendSteps(200, 0.32);
    expect(steps[0]!.value).toBeCloseTo(172.15, 2);
    expect(steps[1]!.value).toBeCloseTo(27.85, 2);
  });
});

import { nitroxFillO2Bar, topUpFO2 } from '../src';

describe('zkratky pro míchání nitroxu', () => {
  it('EAN32 na 200 bar do prázdné lahve: 27,85 bar kyslíku', () => {
    expect(nitroxFillO2Bar(200, 0.32)).toBeCloseTo(27.85, 2);
  });
  it('na zbytek 50 bar EAN32: 20,89 bar kyslíku', () => {
    expect(nitroxFillO2Bar(200, 0.32, 50, 0.32)).toBeCloseTo(20.89, 2);
  });
  it('nemíchatelná směs vyhodí chybu', () => {
    expect(() => nitroxFillO2Bar(110, 0.32, 100)).toThrow(/upuštění/);
  });
  it('60 bar EAN32 doplněno vzduchem na 200 bar = 24,3 %', () => {
    expect(topUpFO2(60, 0.32, 200)).toBeCloseTo(0.243, 10);
  });
});
