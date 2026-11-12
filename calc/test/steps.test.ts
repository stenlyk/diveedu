import { describe, expect, it } from 'vitest';
import {
  absPressureSteps,
  bestMixSteps,
  eadSteps,
  endSteps,
  gasConsumedSteps,
  gasDensitySteps,
  modSteps,
  otuSteps,
  ppO2Steps,
  tex,
  trimix,
  AIR,
  mod,
  ead,
  end,
  gasDensity,
  otu,
  ppO2,
  bestMix,
  gasConsumed,
} from '../src';

const last = <T>(items: T[]): T => items[items.length - 1]!;

describe('tex', () => {
  it('desetinná čárka pro LaTeX, bez koncových nul', () => {
    expect(tex(1.4)).toBe('1{,}4');
    expect(tex(4.375, 3)).toBe('4{,}375');
    expect(tex(30)).toBe('30');
    expect(tex(4.5)).toBe('4{,}5');
    expect(tex(100, 0)).toBe('100');
    expect(tex(0.32)).toBe('0{,}32');
  });
});

describe('rozepsané postupy končí stejnou hodnotou jako výpočet', () => {
  it('absolutní tlak', () => {
    const steps = absPressureSteps(30);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ value: 4, unit: 'bar' });
    expect(steps[0]!.latex).toContain('\\frac{30}{10}');
  });
  it('ppO2', () => {
    const steps = ppO2Steps(0.32, 30);
    expect(last(steps).value).toBe(ppO2(0.32, 30));
    expect(last(steps).latex).toContain('0{,}32 \\cdot 4');
  });
  it('MOD', () => {
    const steps = modSteps(0.32, 1.4);
    expect(steps[0]!.value).toBeCloseTo(4.375, 10);
    expect(last(steps).value).toBe(mod(0.32, 1.4));
    expect(last(steps).unit).toBe('m');
  });
  it('best mix', () => {
    expect(last(bestMixSteps(40, 1.4)).value).toBe(bestMix(40, 1.4));
  });
  it('EAD', () => {
    expect(last(eadSteps(0.32, 30)).value).toBe(ead(0.32, 30));
  });
  it('END v obou variantách', () => {
    const gas = trimix(18, 45);
    const narcotic = endSteps(gas, 60);
    expect(last(narcotic).value).toBe(end(gas, 60));
    expect(narcotic[0]!.latex).toContain('1 - F_{He}');
    const nonNarcotic = endSteps(gas, 60, false);
    expect(last(nonNarcotic).value).toBe(end(gas, 60, { o2Narcotic: false }));
    expect(nonNarcotic[0]!.latex).toContain('F_{N_2}');
  });
  it('hustota', () => {
    const steps = gasDensitySteps(AIR, 30);
    expect(steps).toHaveLength(3);
    expect(last(steps).value).toBe(gasDensity(AIR, 30));
  });
  it('OTU, i pod prahem 0,5 bar', () => {
    expect(last(otuSteps(1.4, 30)).value).toBe(otu(1.4, 30));
    expect(last(otuSteps(0.4, 30)).value).toBe(0);
    expect(otuSteps(0.4, 30)[0]!.value).toBe(0);
  });
  it('spotřeba', () => {
    expect(last(gasConsumedSteps(20, 30, 20)).value).toBe(gasConsumed(20, 30, 20));
  });
});
