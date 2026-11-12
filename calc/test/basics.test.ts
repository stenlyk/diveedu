import { describe, expect, it } from 'vitest';
import {
  absPressure,
  AIR,
  assertFinite,
  assertFraction,
  assertNonNegative,
  assertPositive,
  assertPositiveFraction,
  boyleVolume,
  CalcInputError,
  ceilTo,
  DEFAULT_ENV,
  depthFromPressure,
  EAN32,
  EAN50,
  floorTo,
  fN2,
  formatCs,
  FRESH_WATER_ENV,
  gasLabel,
  gayLussacPressure,
  HELIUM,
  nitrox,
  OXYGEN,
  parseCs,
  pressureRatio,
  roundTo,
  trimix,
  validateEnv,
  validateGas,
} from '../src';

describe('errors', () => {
  it('CalcInputError má jméno a zprávu', () => {
    const error = new CalcInputError('x');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CalcInputError');
  });
  it('assertFinite', () => {
    expect(() => assertFinite(1, 'a')).not.toThrow();
    expect(() => assertFinite(NaN, 'a')).toThrow(CalcInputError);
    expect(() => assertFinite(Infinity, 'a')).toThrow(CalcInputError);
  });
  it('assertNonNegative', () => {
    expect(() => assertNonNegative(0, 'a')).not.toThrow();
    expect(() => assertNonNegative(-0.1, 'a')).toThrow(/záporné/);
  });
  it('assertPositive', () => {
    expect(() => assertPositive(0.1, 'a')).not.toThrow();
    expect(() => assertPositive(0, 'a')).toThrow(/kladné/);
  });
  it('assertFraction', () => {
    expect(() => assertFraction(0, 'a')).not.toThrow();
    expect(() => assertFraction(1, 'a')).not.toThrow();
    expect(() => assertFraction(-0.01, 'a')).toThrow(CalcInputError);
    expect(() => assertFraction(1.01, 'a')).toThrow(CalcInputError);
  });
  it('assertPositiveFraction', () => {
    expect(() => assertPositiveFraction(0.5, 'a')).not.toThrow();
    expect(() => assertPositiveFraction(0, 'a')).toThrow(/větší než 0/);
  });
});

describe('env', () => {
  it('výchozí konvence 10 m = 1 bar', () => {
    expect(DEFAULT_ENV).toEqual({ metersPerBar: 10, surfaceBar: 1 });
    expect(() => validateEnv(DEFAULT_ENV)).not.toThrow();
  });
  it('odmítne nesmyslné prostředí', () => {
    expect(() => validateEnv({ metersPerBar: 0, surfaceBar: 1 })).toThrow(CalcInputError);
    expect(() => validateEnv({ metersPerBar: 10, surfaceBar: -1 })).toThrow(CalcInputError);
  });
});

describe('pressure', () => {
  it('absolutní tlak: hladina 1 bar, 10 m 2 bar, 45 m 5,5 bar', () => {
    expect(absPressure(0)).toBe(1);
    expect(absPressure(10)).toBe(2);
    expect(absPressure(45)).toBe(5.5);
  });
  it('sladká voda a nadmořská výška', () => {
    expect(absPressure(10.3, FRESH_WATER_ENV)).toBeCloseTo(2, 10);
    expect(absPressure(10, { metersPerBar: 10, surfaceBar: 0.8 })).toBeCloseTo(1.8, 10);
  });
  it('odmítne zápornou hloubku a NaN', () => {
    expect(() => absPressure(-1)).toThrow(CalcInputError);
    expect(() => absPressure(NaN)).toThrow(CalcInputError);
  });
  it('depthFromPressure je inverze absPressure', () => {
    expect(depthFromPressure(4)).toBe(30);
    expect(depthFromPressure(absPressure(37.5))).toBeCloseTo(37.5, 10);
    expect(depthFromPressure(0.5)).toBe(-5);
    expect(depthFromPressure(2, FRESH_WATER_ENV)).toBeCloseTo(10.3, 10);
    expect(() => depthFromPressure(0)).toThrow(CalcInputError);
  });
  it('poměr tlaků: hladina → 10 m dvojnásobek, 30 → 40 m 1,25×', () => {
    expect(pressureRatio(0, 10)).toBe(2);
    expect(pressureRatio(30, 40)).toBeCloseTo(1.25, 10);
    expect(pressureRatio(0, 10.3, FRESH_WATER_ENV)).toBeCloseTo(2, 10);
  });
  it('Boyle: 6 l z 20 m na hladinu = 18 l; 10 l z hladiny do 40 m = 2 l', () => {
    expect(boyleVolume(6, 20, 0)).toBeCloseTo(18, 10);
    expect(boyleVolume(10, 0, 40)).toBeCloseTo(2, 10);
    expect(boyleVolume(10, 0, 10.3, FRESH_WATER_ENV)).toBeCloseTo(5, 10);
    expect(() => boyleVolume(-1, 0, 10)).toThrow(CalcInputError);
  });
  it('Gay-Lussac: 200 bar při 40 °C zchladne na 7 °C → 178,9 bar', () => {
    // 200 · 280,15 / 313,15 = 178,92
    expect(gayLussacPressure(200, 40, 7)).toBeCloseTo(178.92, 2);
    expect(gayLussacPressure(200, 20, 20)).toBeCloseTo(200, 10);
  });
  it('Gay-Lussac odmítne teplotu pod absolutní nulou', () => {
    expect(() => gayLussacPressure(200, -300, 20)).toThrow(/absolutní nulou/);
    expect(() => gayLussacPressure(200, 20, -273.15)).toThrow(/absolutní nulou/);
    expect(() => gayLussacPressure(-1, 20, 20)).toThrow(CalcInputError);
    expect(() => gayLussacPressure(200, NaN, 20)).toThrow(CalcInputError);
    expect(() => gayLussacPressure(200, 20, Infinity)).toThrow(CalcInputError);
  });
});

describe('gas', () => {
  it('fN2 je zbytek do 1', () => {
    expect(fN2(AIR)).toBeCloseTo(0.79, 10);
    expect(fN2(trimix(18, 45))).toBeCloseTo(0.37, 10);
    expect(fN2(OXYGEN)).toBe(0);
    expect(fN2(HELIUM)).toBe(0);
    expect(fN2({ fO2: 0.3, fHe: 0.7 })).toBe(0);
  });
  it('validace směsi', () => {
    expect(() => validateGas({ fO2: 0.6, fHe: 0.5 })).toThrow(/součet/);
    expect(() => validateGas({ fO2: -0.1, fHe: 0 })).toThrow(CalcInputError);
    expect(() => validateGas({ fO2: 0.2, fHe: 1.2 })).toThrow(CalcInputError);
    expect(() => nitrox(120)).toThrow(CalcInputError);
    expect(() => trimix(60, 60)).toThrow(CalcInputError);
  });
  it('konstruktory', () => {
    expect(nitrox(32)).toEqual(EAN32);
    expect(trimix(18, 45)).toEqual({ fO2: 0.18, fHe: 0.45 });
  });
  it('názvy směsí', () => {
    expect(gasLabel(AIR)).toBe('vzduch');
    expect(gasLabel(EAN32)).toBe('EAN32');
    expect(gasLabel(EAN50)).toBe('EAN50');
    expect(gasLabel(OXYGEN)).toBe('kyslík');
    expect(gasLabel(trimix(18, 45))).toBe('Tx 18/45');
  });
});

describe('format', () => {
  it('floorTo zaokrouhluje dolů (MOD)', () => {
    expect(floorTo(33.75)).toBe(33);
    expect(floorTo(56.67, 0.5)).toBe(56.5);
    expect(floorTo(30)).toBe(30);
    // 0,1 + 0,2 = 0,30000000000000004 nesmí spadnout pod 0,3
    expect(floorTo((0.1 + 0.2) * 100)).toBe(30);
  });
  it('ceilTo zaokrouhluje nahoru (spotřeba)', () => {
    expect(ceilTo(20.55)).toBe(21);
    expect(ceilTo(493.3, 10)).toBe(500);
    expect(ceilTo(30)).toBe(30);
    expect(ceilTo(0.1 * 3 * 10)).toBe(3);
  });
  it('floorTo/ceilTo odmítnou nesmyslný krok', () => {
    expect(() => floorTo(1, 0)).toThrow(CalcInputError);
    expect(() => ceilTo(1, -1)).toThrow(CalcInputError);
    expect(() => floorTo(NaN)).toThrow(CalcInputError);
    expect(() => ceilTo(Infinity)).toThrow(CalcInputError);
  });
  it('roundTo', () => {
    expect(roundTo(24.43, 1)).toBe(24.4);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(5.6)).toBe(6);
    expect(roundTo(-2.5)).toBe(-3);
    expect(() => roundTo(NaN)).toThrow(CalcInputError);
  });
  it('formatCs používá desetinnou čárku', () => {
    expect(formatCs(33.75, 2)).toBe('33,75');
    expect(formatCs(5.153, 2)).toBe('5,15');
    expect(formatCs(28.5)).toBe('29');
    expect(formatCs(-0.001, 2)).toBe('0,00');
    expect(formatCs(-0.2)).toBe('0');
    expect(formatCs(-1.5, 1)).toBe('-1,5');
  });
  it('parseCs čte čárku i tečku', () => {
    expect(parseCs('33,75')).toBe(33.75);
    expect(parseCs(' 1.4 ')).toBe(1.4);
    expect(parseCs('-5')).toBe(-5);
    expect(parseCs('1 000')).toBe(1000);
    expect(parseCs('')).toBeNull();
    expect(parseCs('abc')).toBeNull();
    expect(parseCs('1,2,3')).toBeNull();
  });
});
