import { AIR, EAN50, OXYGEN, trimix } from '@diveedu/calc';
import { describe, expect, it } from 'vitest';
import { analyzePlan, DEFAULT_PLAN_LIMITS, planDive, type PlanGas } from '../src';

const kinds = (gases: PlanGas[], input: Partial<Parameters<typeof planDive>[0]> = {}) => {
  const plan = planDive({ depthM: 60, bottomMinutes: 20, gases, gfLow: 50, gfHigh: 80, ...input });
  return { plan, analysis: analyzePlan(plan, gases) };
};

describe('víceúrovňový profil a travel gas', () => {
  it('travel gas se dýchá při sestupu do hloubky přepnutí, pak plyn pro dno', () => {
    const gases: PlanGas[] = [{ gas: trimix(10, 70) }, { gas: trimix(21, 35), switchDepthM: 57, useOnDescent: true }, { gas: EAN50, switchDepthM: 21 }];
    const plan = planDive({ depthM: 90, bottomMinutes: 15, gases, gfLow: 50, gfHigh: 80 });
    const descent = plan.samples.filter((s) => s.t <= 90 / 20 + 1e-6);
    expect(descent.filter((s) => s.depthM > 0 && s.depthM < 57).every((s) => s.gasIndex === 1)).toBe(true);
    expect(descent.filter((s) => s.depthM > 57 + 1e-6).every((s) => s.gasIndex === 0)).toBe(true);
    expect(plan.samples.find((s) => Math.abs(s.depthM - 90) < 1e-6)!.gasIndex).toBe(0);
    // Při výstupu se travel gas použije znovu a pak EAN50.
    const ascent = plan.samples.filter((s) => s.t > 15);
    expect(ascent.some((s) => s.gasIndex === 1)).toBe(true);
    expect(ascent.some((s) => s.gasIndex === 2)).toBe(true);
  });
  it('travel gas s hloubkou přepnutí větší než dno se dýchá celý sestup', () => {
    const gases: PlanGas[] = [{ gas: trimix(18, 45) }, { gas: AIR, switchDepthM: 60, useOnDescent: true }];
    const plan = planDive({ depthM: 40, bottomMinutes: 10, gases, gfLow: 50, gfHigh: 80 });
    expect(plan.samples.filter((s) => s.t < 2 - 1e-6).every((s) => s.gasIndex === 1)).toBe(true);
    expect(plan.samples.filter((s) => s.t > 2 + 1e-6 && s.t <= 10).every((s) => s.gasIndex === 0)).toBe(true);
  });
  it('další úrovně prodlouží ponor a změní dekompresi', () => {
    const base = { depthM: 45, bottomMinutes: 20, gases: [{ gas: AIR }], gfLow: 30, gfHigh: 85 };
    const single = planDive(base);
    const multi = planDive({ ...base, levels: [{ depthM: 30, minutes: 15 }, { depthM: 36, minutes: 0 }] });
    expect(multi.runtimeMin).toBeGreaterThan(single.runtimeMin + 15);
    expect(multi.samples.some((s) => Math.abs(s.depthM - 30) < 1e-6 && s.t > 21)).toBe(true);
    expect(multi.samples.some((s) => Math.abs(s.depthM - 36) < 1e-6 && s.t > 36)).toBe(true);
  });
  it('odmítne neplatnou úroveň', () => {
    const base = { depthM: 45, bottomMinutes: 20, gases: [{ gas: AIR }], gfLow: 30, gfHigh: 85 };
    expect(() => planDive({ ...base, levels: [{ depthM: 0, minutes: 5 }] })).toThrow(/úroveň/);
    expect(() => planDive({ ...base, levels: [{ depthM: 30, minutes: -1 }] })).toThrow(/úroveň/);
  });
});

describe('rozbor plánu', () => {
  it('dobře postavený trimixový plán nemá výhrady', () => {
    const { analysis } = kinds([{ gas: trimix(18, 45) }, { gas: trimix(50, 15), switchDepthM: 21 }, { gas: OXYGEN, switchDepthM: 6 }]);
    expect(analysis.issues).toEqual([]);
    expect(analysis.maxPpO2Bar).toBeCloseTo(1.6, 6);
    expect(analysis.minPpO2Bar).toBeCloseTo(0.18, 6);
    expect(analysis.maxEndM).toBeCloseTo(28.5, 6);
    expect(analysis.maxDensityGL).toBeCloseTo(5.6, 1);
    expect(analysis.cnsPercent).toBeGreaterThan(10);
    expect(analysis.cnsPercent).toBeLessThan(80);
    expect(analysis.otu).toBeGreaterThan(20);
    expect(analysis.switches.map((s) => [s.depthM, s.toIndex, s.icdOk])).toEqual([[21, 1, true], [6, 2, true]]);
  });
  it('vzduch v 60 m: ppO2, END i hustota nad limitem', () => {
    const { analysis } = kinds([{ gas: AIR }]);
    expect(analysis.issues.map((i) => i.kind).sort()).toEqual(['density', 'end', 'ppo2-high']);
    const density = analysis.issues.find((i) => i.kind === 'density')!;
    expect(density).toMatchObject({ depthM: 60, gasIndex: 0 });
  });
  it('hypoxická směs dýchaná od hladiny a přepnutí He → N2 proti pravidlu pětin', () => {
    const { analysis } = kinds([{ gas: trimix(10, 70) }, { gas: EAN50, switchDepthM: 21 }], { depthM: 90, bottomMinutes: 12 });
    const found = analysis.issues.map((i) => i.kind);
    expect(found).toContain('hypoxic');
    expect(found).toContain('icd');
    expect(analysis.issues.find((i) => i.kind === 'hypoxic')).toMatchObject({ depthM: 0, gasIndex: 0 });
    expect(analysis.switches[0]!.icdOk).toBe(false);
  });
  it('hypoxická směs bez dalšího plynu: ohlásí se nejnižší ppO2 celého ponoru', () => {
    const { analysis } = kinds([{ gas: trimix(10, 70) }], { depthM: 60, bottomMinutes: 10 });
    const hypoxic = analysis.issues.filter((i) => i.kind === 'hypoxic');
    expect(hypoxic).toHaveLength(1);
    expect(hypoxic[0]).toMatchObject({ depthM: 0 });
    expect(analysis.minPpO2Bar).toBeCloseTo(0.1, 6);
  });
  it('travel gas odstraní hypoxii u hladiny', () => {
    const { analysis } = kinds([{ gas: trimix(10, 70) }, { gas: trimix(21, 35), switchDepthM: 57, useOnDescent: true }], { depthM: 90, bottomMinutes: 12 });
    expect(analysis.issues.map((i) => i.kind)).not.toContain('hypoxic');
  });
  it('dekompresní plyn nasazený pod svou MOD: ppO2 mimo tabulku CNS', () => {
    const { analysis } = kinds([{ gas: trimix(18, 45) }, { gas: OXYGEN, switchDepthM: 21 }]);
    const found = analysis.issues.map((i) => i.kind);
    expect(found).toContain('ppo2-high');
    expect(found).toContain('cns-off-table');
    expect(analysis.cnsPercent).toBeNull();
  });
  it('dlouhá kyslíková dekomprese vyčerpá CNS hodiny', () => {
    const { analysis } = kinds([{ gas: AIR }, { gas: OXYGEN, switchDepthM: 6 }], { depthM: 51, bottomMinutes: 45, gfLow: 30, gfHigh: 70 });
    expect(analysis.issues.find((i) => i.kind === 'cns')).toBeDefined();
    expect(analysis.cnsPercent).toBeGreaterThan(80);
  });
  it('výstup na mělčí úroveň nad strop se ohlásí', () => {
    const gases = [{ gas: AIR }];
    const plan = planDive({ depthM: 51, bottomMinutes: 30, gases, gfLow: 30, gfHigh: 85, levels: [{ depthM: 9, minutes: 5 }] });
    const analysis = analyzePlan(plan, gases);
    expect(analysis.issues.find((i) => i.kind === 'ceiling')).toBeDefined();
  });
  it('vlastní limity', () => {
    const gases = [{ gas: trimix(18, 45) }];
    const plan = planDive({ depthM: 60, bottomMinutes: 15, gases, gfLow: 50, gfHigh: 80 });
    expect(analyzePlan(plan, gases, { ...DEFAULT_PLAN_LIMITS, endMaxM: 25, densityMaxGL: 5.2 }).issues.map((i) => i.kind).sort()).toEqual(['density', 'end']);
  });
});
