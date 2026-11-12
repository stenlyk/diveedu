import { describe, expect, it } from 'vitest';
import {
  barToLiters,
  CalcInputError,
  FRESH_WATER_ENV,
  gasConsumed,
  litersToBar,
  rockBottom,
  ruleOfThirds,
  ruleOfThirdsPractical,
  sacFromLog,
  teamTurnPressure,
  turnPressure,
} from '../src';

describe('spotřeba', () => {
  it('SAC 20 l/min ve 30 m po 20 min = 1600 l', () => {
    expect(gasConsumed(20, 30, 20)).toBe(1600);
    expect(gasConsumed(20, 30.9, 20, FRESH_WATER_ENV)).toBeCloseTo(1600, 8);
  });
  it('odmítne záporné vstupy', () => {
    expect(() => gasConsumed(-1, 30, 20)).toThrow(CalcInputError);
    expect(() => gasConsumed(20, 30, -1)).toThrow(CalcInputError);
  });
  it('převody litry ↔ bary', () => {
    expect(litersToBar(1600, 24)).toBeCloseTo(66.67, 2);
    expect(barToLiters(200, 12)).toBe(2400);
    expect(() => litersToBar(100, 0)).toThrow(CalcInputError);
    expect(() => litersToBar(-1, 12)).toThrow(CalcInputError);
    expect(() => barToLiters(-1, 12)).toThrow(CalcInputError);
    expect(() => barToLiters(100, 0)).toThrow(CalcInputError);
  });
});

describe('SAC z logu', () => {
  it('12 l lahev, 200 → 50 bar, 40 min v průměru 20 m = 15 l/min', () => {
    expect(
      sacFromLog({ startBar: 200, endBar: 50, tankLiters: 12, avgDepthM: 20, minutes: 40 }),
    ).toBeCloseTo(15, 10);
  });
  it('sladká voda', () => {
    expect(
      sacFromLog(
        { startBar: 200, endBar: 50, tankLiters: 12, avgDepthM: 20.6, minutes: 40 },
        FRESH_WATER_ENV,
      ),
    ).toBeCloseTo(15, 10);
  });
  it('odmítne nesmyslný log', () => {
    const log = { startBar: 200, endBar: 50, tankLiters: 12, avgDepthM: 20, minutes: 40 };
    expect(() => sacFromLog({ ...log, endBar: 210 })).toThrow(/vyšší/);
    expect(() => sacFromLog({ ...log, minutes: 0 })).toThrow(CalcInputError);
    expect(() => sacFromLog({ ...log, endBar: -1 })).toThrow(CalcInputError);
  });
});

describe('rock bottom', () => {
  it('30 m, 20 l/min, dva potápěči, 1 min řešení, výstup 9 m/min = 493 l', () => {
    // 2 · 20 · (4 · 1 + 2,5 · 30/9) = 40 · 12,333 = 493,3
    const liters = rockBottom({ depthM: 30, sacLpm: 20 });
    expect(liters).toBeCloseTo(493.33, 2);
    expect(litersToBar(liters, 24)).toBeCloseTo(20.56, 2);
  });
  it('se zastávkou a vlastními parametry', () => {
    // 1 · 25 · (5 · 2 + 3 · 40/10 + 1,5 · 3) = 25 · 26,5 = 662,5
    expect(
      rockBottom({
        depthM: 40,
        sacLpm: 25,
        divers: 1,
        solveMinutes: 2,
        ascentRateMpm: 10,
        stops: [{ depthM: 5, minutes: 3 }],
      }),
    ).toBeCloseTo(662.5, 8);
  });
  it('sladká voda a neplatné vstupy', () => {
    expect(rockBottom({ depthM: 30.9, sacLpm: 20, ascentRateMpm: 9.27 }, FRESH_WATER_ENV)).toBeCloseTo(
      493.33,
      2,
    );
    expect(() => rockBottom({ depthM: 30, sacLpm: 20, divers: 0 })).toThrow(CalcInputError);
    expect(() => rockBottom({ depthM: 30, sacLpm: 20, ascentRateMpm: 0 })).toThrow(CalcInputError);
  });
});

describe('pravidlo třetin', () => {
  it('přesně: 210 bar → 70 dovnitř, otočka 140', () => {
    expect(ruleOfThirds(210)).toEqual({ usableBar: 70, turnBar: 140 });
  });
  it('prakticky: 200 bar → 60 dovnitř, otočka 140', () => {
    expect(ruleOfThirdsPractical(200)).toEqual({ usableBar: 60, turnBar: 140 });
    expect(ruleOfThirdsPractical(210)).toEqual({ usableBar: 70, turnBar: 140 });
    expect(ruleOfThirdsPractical(230, 5)).toEqual({ usableBar: 75, turnBar: 155 });
  });
  it('obecný tlak otočky', () => {
    expect(turnPressure(240, 1 / 4)).toBeCloseTo(180, 10);
    expect(turnPressure(240, 1 / 6)).toBeCloseTo(200, 10);
    expect(turnPressure(200, 0)).toBe(200);
  });
  it('odmítne neplatné vstupy', () => {
    expect(() => ruleOfThirds(-1)).toThrow(CalcInputError);
    expect(() => ruleOfThirdsPractical(-1)).toThrow(CalcInputError);
    expect(() => ruleOfThirdsPractical(200, 0)).toThrow(CalcInputError);
    expect(() => turnPressure(200, 1.5)).toThrow(/0–1/);
    expect(() => turnPressure(200, NaN)).toThrow(/0–1/);
    expect(() => turnPressure(-1, 0.3)).toThrow(CalcInputError);
  });
});

describe('otočka dvojice', () => {
  const twin = { tankLiters: 24, startBar: 200, sacLpm: 20 };
  it('stejné lahve i spotřeba = klasické třetiny', () => {
    const turn = teamTurnPressure(twin, twin);
    expect(turn.a.turnBar).toBeCloseTo(133.33, 2);
    expect(turn.b.turnBar).toBeCloseTo(133.33, 2);
    expect(turn.limitedBy).toBe('a');
  });
  it('různá spotřeba: otáčí ten s vyšší SAC na své třetině', () => {
    const turn = teamTurnPressure(twin, { ...twin, sacLpm: 15 });
    expect(turn.limitedBy).toBe('a');
    expect(turn.a.turnBar).toBeCloseTo(133.33, 2);
    // b za stejnou dobu spotřebuje 15/20 třetiny: 50 bar → otočka 150
    expect(turn.b.usableBar).toBeCloseTo(50, 8);
    expect(turn.b.turnBar).toBeCloseTo(150, 8);
  });
  it('různé lahve: třetina menší lahve přepočtená na větší', () => {
    const small = { tankLiters: 12, startBar: 200, sacLpm: 20 };
    const turn = teamTurnPressure(small, twin);
    expect(turn.limitedBy).toBe('a');
    expect(turn.a.usableLiters).toBeCloseTo(800, 8);
    expect(turn.a.turnBar).toBeCloseTo(133.33, 2);
    expect(turn.b.usableBar).toBeCloseTo(33.33, 2);
    expect(turn.b.turnBar).toBeCloseTo(166.67, 2);
  });
  it('malá lahev u úsporného potápěče: musí otočit dřív než na třetině', () => {
    // a: 2400 l, SAC 12; b: 4800 l, SAC 24. Rezerva a musí vyvést oba: 2400 / (2·12 + 24) = 50
    const turn = teamTurnPressure(
      { tankLiters: 12, startBar: 200, sacLpm: 12 },
      { tankLiters: 24, startBar: 200, sacLpm: 24 },
    );
    expect(turn.limitedBy).toBe('a');
    expect(turn.a.usableLiters).toBeCloseTo(600, 8);
    expect(turn.a.turnBar).toBeCloseTo(150, 8);
    expect(turn.b.turnBar).toBeCloseTo(150, 8);
  });
  it('limitovat může i druhý potápěč', () => {
    expect(teamTurnPressure({ ...twin, sacLpm: 15 }, twin).limitedBy).toBe('b');
  });
  it('rezerva po otočce vždy stačí na cestu ven pro oba', () => {
    const cases = [
      [twin, { tankLiters: 12, startBar: 230, sacLpm: 17 }],
      [{ tankLiters: 15, startBar: 210, sacLpm: 25 }, { tankLiters: 24, startBar: 190, sacLpm: 14 }],
    ] as const;
    for (const [a, b] of cases) {
      const turn = teamTurnPressure(a, b);
      const exitBoth = turn.a.usableLiters + turn.b.usableLiters;
      expect(a.tankLiters * a.startBar - turn.a.usableLiters).toBeGreaterThanOrEqual(exitBoth - 1e-6);
      expect(b.tankLiters * b.startBar - turn.b.usableLiters).toBeGreaterThanOrEqual(exitBoth - 1e-6);
      expect(turn.a.usableBar).toBeLessThanOrEqual(a.startBar / 3 + 1e-9);
      expect(turn.b.usableBar).toBeLessThanOrEqual(b.startBar / 3 + 1e-9);
    }
  });
  it('odmítne neplatné vstupy', () => {
    expect(() => teamTurnPressure({ ...twin, sacLpm: 0 }, twin)).toThrow(CalcInputError);
    expect(() => teamTurnPressure(twin, { ...twin, tankLiters: 0 })).toThrow(CalcInputError);
    expect(() => teamTurnPressure(twin, { ...twin, startBar: -1 })).toThrow(CalcInputError);
  });
});

import { decoGasLiters, rockBottomBar, rockBottomLiters, rockBottomSteps, sacBarPerMinute, sacFromPressureDrop, sacSteps, thirdsTurnBar, travelMinutes } from '../src';

describe('zkratky pro plánování plynu', () => {
  it('SAC z poklesu tlaku', () => {
    expect(sacFromPressureDrop(200, 50, 12, 20, 40)).toBeCloseTo(15, 10);
  });
  it('rock bottom v litrech a barech', () => {
    expect(rockBottomLiters(30, 20)).toBeCloseTo(493.33, 2);
    expect(rockBottomBar(30, 20, 24)).toBeCloseTo(20.56, 2);
  });
  it('otočka podle třetin', () => {
    expect(thirdsTurnBar(200)).toBe(140);
    expect(thirdsTurnBar(210)).toBe(140);
    expect(thirdsTurnBar(230)).toBe(160);
  });
  it('doba přesunu mezi hloubkami', () => {
    expect(travelMinutes(45, 21, 9)).toBeCloseTo(2.667, 3);
    expect(travelMinutes(0, 40, 20)).toBe(2);
    expect(() => travelMinutes(-1, 0, 9)).toThrow(CalcInputError);
    expect(() => travelMinutes(0, -1, 9)).toThrow(CalcInputError);
    expect(() => travelMinutes(10, 0, 0)).toThrow(CalcInputError);
  });
  it('spotřeba v barech za minutu', () => {
    // 20 l/min · 4 bar = 80 l/min z dvojčete 24 l = 3,33 bar/min
    expect(sacBarPerMinute(20, 30, 24)).toBeCloseTo(3.333, 3);
    expect(sacBarPerMinute(20, 30.9, 24, FRESH_WATER_ENV)).toBeCloseTo(3.333, 3);
  });
  it('plyn na dekompresi s rezervou', () => {
    // 15 l/min: 5 min v 6 m (1,6 bar) = 120 l, 10 min ve 3 m (1,3 bar) = 195 l; × 1,5 = 472,5 l
    const stops = [{ depthM: 6, minutes: 5 }, { depthM: 3, minutes: 10 }];
    expect(decoGasLiters(15, stops)).toBeCloseTo(472.5, 8);
    expect(decoGasLiters(15, stops, 1)).toBeCloseTo(315, 8);
    expect(decoGasLiters(15, stops, 2, FRESH_WATER_ENV)).toBeLessThan(630);
    expect(() => decoGasLiters(15, stops, 0)).toThrow(CalcInputError);
  });
  it('rozepsané postupy končí stejnou hodnotou jako výpočet', () => {
    const sac = sacSteps(200, 50, 12, 20, 40);
    expect(sac.map((s) => s.value)).toEqual([1800, 3, 15]);
    const rb = rockBottomSteps(30, 20, 24);
    expect(rb).toHaveLength(5);
    expect(rb[3]!.value).toBeCloseTo(rockBottomLiters(30, 20), 10);
    expect(rb[4]!.value).toBeCloseTo(rockBottomBar(30, 20, 24), 10);
  });
});

import { teamTurnBar } from '../src';

describe('otočka jednoho z dvojice', () => {
  it('malá lahev otáčí na své třetině, velká drží rezervu pro oba', () => {
    expect(teamTurnBar(12, 20, 24, 20, 200)).toBeCloseTo(133.33, 2);
    expect(teamTurnBar(24, 20, 12, 20, 200)).toBeCloseTo(166.67, 2);
  });
  it('stejné lahve a různá spotřeba: úspornější otáčí dřív na manometru', () => {
    expect(teamTurnBar(24, 20, 24, 15, 210)).toBeCloseTo(140, 8);
    expect(teamTurnBar(24, 15, 24, 20, 210)).toBeCloseTo(157.5, 8);
  });
});
