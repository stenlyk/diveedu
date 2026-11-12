import { describe, expect, it } from 'vitest';
import {
  bestMix,
  CalcInputError,
  cnsLimitMinutes,
  cnsPercent,
  cnsTotalPercent,
  FRESH_WATER_ENV,
  minDepthForPpO2,
  mod,
  NOAA_CNS_TABLE,
  otu,
  otuMultiDay,
  otuTotal,
  ppO2,
  repexDailyLimit,
} from '../src';

describe('ppO2', () => {
  it('EAN32 ve 30 m = 1,28 bar; vzduch na hladině = 0,21 bar', () => {
    expect(ppO2(0.32, 30)).toBeCloseTo(1.28, 10);
    expect(ppO2(0.21, 0)).toBeCloseTo(0.21, 10);
  });
  it('kyslík v 6 m = 1,6 bar', () => {
    expect(ppO2(1, 6)).toBeCloseTo(1.6, 10);
  });
  it('sladká voda', () => {
    expect(ppO2(0.5, 10.3, FRESH_WATER_ENV)).toBeCloseTo(1, 10);
  });
  it('odmítne neplatnou frakci', () => {
    expect(() => ppO2(1.2, 10)).toThrow(CalcInputError);
  });
});

describe('MOD', () => {
  it('EAN50 při 1,6 = 22 m; kyslík při 1,6 = 6 m', () => {
    expect(mod(0.5, 1.6)).toBeCloseTo(22, 10);
    expect(mod(1, 1.6)).toBeCloseTo(6, 10);
  });
  it('nikdy záporná: kyslík s limitem 0,9 bar → 0 m', () => {
    expect(mod(1, 0.9)).toBe(0);
  });
  it('sladká voda dává o něco větší hloubku', () => {
    expect(mod(0.32, 1.4, FRESH_WATER_ENV)).toBeCloseTo(34.7625, 4);
  });
  it('odmítne fO2 = 0 a nulový limit', () => {
    expect(() => mod(0, 1.4)).toThrow(CalcInputError);
    expect(() => mod(0.32, 0)).toThrow(CalcInputError);
  });
  it('MOD best mixu se rovná zadané hloubce', () => {
    for (const depth of [18, 27, 33, 40, 51]) {
      expect(mod(bestMix(depth, 1.4), 1.4)).toBeCloseTo(depth, 8);
    }
  });
});

describe('best mix', () => {
  it('30 m při 1,4 = 0,35; 21 m při 1,6 = 0,516', () => {
    expect(bestMix(30, 1.4)).toBeCloseTo(0.35, 10);
    expect(bestMix(21, 1.6)).toBeCloseTo(0.5161, 4);
  });
  it('nejvýše čistý kyslík', () => {
    expect(bestMix(3, 1.6)).toBe(1);
  });
  it('sladká voda a neplatný limit', () => {
    expect(bestMix(30.9, 1.4, FRESH_WATER_ENV)).toBeCloseTo(0.35, 10);
    expect(() => bestMix(30, 0)).toThrow(CalcInputError);
  });
});

describe('minimální hloubka hypoxické směsi', () => {
  it('Tx 10/70 při ppO2 min 0,18 → 8 m', () => {
    expect(minDepthForPpO2(0.1, 0.18)).toBeCloseTo(8, 10);
  });
  it('normoxická směs je dýchatelná od hladiny', () => {
    expect(minDepthForPpO2(0.21, 0.18)).toBe(0);
  });
  it('sladká voda a neplatné vstupy', () => {
    expect(minDepthForPpO2(0.1, 0.18, FRESH_WATER_ENV)).toBeCloseTo(8.24, 2);
    expect(() => minDepthForPpO2(0, 0.18)).toThrow(CalcInputError);
    expect(() => minDepthForPpO2(0.1, 0)).toThrow(CalcInputError);
  });
});

describe('CNS (NOAA)', () => {
  it('řádky tabulky vrací přesně', () => {
    for (const [pp, minutes] of NOAA_CNS_TABLE) {
      expect(cnsLimitMinutes(pp)).toBeCloseTo(minutes, 8);
    }
    expect(cnsLimitMinutes(1.4)).toBeCloseTo(150, 8);
    expect(cnsLimitMinutes(1.6)).toBeCloseTo(45, 8);
  });
  it('mezi řádky interpoluje lineárně', () => {
    expect(cnsLimitMinutes(1.35)).toBeCloseTo(165, 6); // mezi 180 a 150
    expect(cnsLimitMinutes(1.55)).toBeCloseTo(82.5, 6); // mezi 120 a 45
    expect(cnsLimitMinutes(0.65)).toBeCloseTo(645, 6); // mezi 720 a 570
  });
  it('do 0,5 bar se zátěž nepočítá', () => {
    expect(cnsLimitMinutes(0.5)).toBe(Infinity);
    expect(cnsLimitMinutes(0.21)).toBe(Infinity);
    expect(cnsPercent(0.4, 600)).toBe(0);
  });
  it('mezi 0,5 a 0,6 bar platí konzervativně limit pro 0,6', () => {
    expect(cnsLimitMinutes(0.55)).toBe(720);
  });
  it('nad 1,6 bar je mimo tabulku a neextrapoluje se', () => {
    expect(cnsLimitMinutes(1.61)).toBeNull();
    expect(cnsPercent(1.8, 10)).toBeNull();
  });
  it('zaokrouhlovací šum těsně nad 1,6 bar se bere jako 1,6', () => {
    expect(cnsLimitMinutes(1.6 + 1e-12)).toBe(45);
  });
  it('CNS %: 1,4 bar po 30 min = 20 %; 1,6 bar po 45 min = 100 %', () => {
    expect(cnsPercent(1.4, 30)).toBeCloseTo(20, 8);
    expect(cnsPercent(1.6, 45)).toBeCloseTo(100, 8);
  });
  it('součet úseků', () => {
    // 30 min na 1,4 (20 %) + 15 min na 1,6 (33,3 %)
    expect(
      cnsTotalPercent([
        { ppO2Bar: 1.4, minutes: 30 },
        { ppO2Bar: 1.6, minutes: 15 },
      ]),
    ).toBeCloseTo(53.33, 2);
    expect(cnsTotalPercent([])).toBe(0);
    expect(
      cnsTotalPercent([
        { ppO2Bar: 1.4, minutes: 30 },
        { ppO2Bar: 1.7, minutes: 5 },
      ]),
    ).toBeNull();
  });
  it('odmítne záporné vstupy', () => {
    expect(() => cnsLimitMinutes(-1)).toThrow(CalcInputError);
    expect(() => cnsPercent(1.4, -1)).toThrow(CalcInputError);
  });
});

describe('OTU', () => {
  it('1 bar po 60 min = 60 OTU (definice jednotky)', () => {
    expect(otu(1, 60)).toBeCloseTo(60, 10);
  });
  it('1,6 bar po 20 min = 38,5 OTU', () => {
    // 20 · 2,2^0,83 = 20 · 1,924 = 38,48
    expect(otu(1.6, 20)).toBeCloseTo(38.48, 1);
  });
  it('do 0,5 bar je nulová', () => {
    expect(otu(0.5, 100)).toBe(0);
    expect(otu(0.3, 100)).toBe(0);
  });
  it('součet úseků', () => {
    expect(
      otuTotal([
        { ppO2Bar: 1, minutes: 60 },
        { ppO2Bar: 0.4, minutes: 30 },
      ]),
    ).toBeCloseTo(60, 10);
  });
  it('odmítne záporné vstupy', () => {
    expect(() => otu(-1, 10)).toThrow(CalcInputError);
    expect(() => otu(1, -10)).toThrow(CalcInputError);
  });
});

describe('vícedenní OTU (REPEX)', () => {
  it('denní limity', () => {
    expect(repexDailyLimit(1)).toBe(850);
    expect(repexDailyLimit(2)).toBe(700);
    expect(repexDailyLimit(5)).toBe(460);
    expect(repexDailyLimit(11)).toBe(300);
    expect(repexDailyLimit(30)).toBe(300);
    expect(() => repexDailyLimit(0)).toThrow(CalcInputError);
  });
  it('souhrn v limitu', () => {
    const summary = otuMultiDay([300, 250, 280]);
    expect(summary.total).toBe(830);
    expect(summary.dailyLimit).toBe(620);
    expect(summary.totalLimit).toBe(1860);
    expect(summary.withinLimit).toBe(true);
    expect(summary.perDay).toEqual([300, 250, 280]);
  });
  it('souhrn nad limitem', () => {
    expect(otuMultiDay([900]).withinLimit).toBe(false);
  });
  it('odmítne prázdný seznam a záporné hodnoty', () => {
    expect(() => otuMultiDay([])).toThrow(CalcInputError);
    expect(() => otuMultiDay([100, -1])).toThrow(CalcInputError);
  });
});
