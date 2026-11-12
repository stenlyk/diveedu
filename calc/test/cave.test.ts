import { describe, expect, it } from 'vitest';
import { CalcInputError, exitGasBar, exitMinutes, minutesOnGas, penetrationDistance, turnPressureForSpeeds, usableFraction } from '../src';

describe('dosah a návrat', () => {
  it('60 bar z dvojčete 24 l při 20 l/min ve 20 m vystačí na 24 minut', () => {
    // 60 bar · 24 l = 1440 l; 20 l/min · 3 bar = 60 l/min
    expect(minutesOnGas(60, 24, 20, 20)).toBeCloseTo(24, 10);
    expect(() => minutesOnGas(-1, 24, 20, 20)).toThrow(CalcInputError);
    expect(() => minutesOnGas(60, 24, 0, 20)).toThrow(CalcInputError);
  });
  it('dosah při 15 m/min je 360 m', () => {
    expect(penetrationDistance(60, 24, 20, 20, 15)).toBeCloseTo(360, 8);
    expect(penetrationDistance(60, 24, 20, 20, 0)).toBe(0);
    expect(() => penetrationDistance(60, 24, 20, 20, -1)).toThrow(CalcInputError);
  });
  it('návrat z 360 m rychlostí 15 m/min trvá 24 minut, poloviční rychlostí 48', () => {
    expect(exitMinutes(360, 15)).toBe(24);
    expect(exitMinutes(360, 7.5)).toBe(48);
    expect(() => exitMinutes(-1, 15)).toThrow(CalcInputError);
    expect(() => exitMinutes(10, 0)).toThrow(CalcInputError);
  });
  it('plyn na cestu ven pro dva je dvojnásobek cesty dovnitř', () => {
    expect(exitGasBar(360, 15, 20, 20, 24)).toBeCloseTo(120, 8);
    expect(exitGasBar(360, 15, 20, 20, 24, 1)).toBeCloseTo(60, 8);
    expect(() => exitGasBar(360, 15, 20, 20, 24, 0)).toThrow(CalcInputError);
  });
});

describe('otočka při různých rychlostech', () => {
  it('stejná rychlost tam a zpět dává třetinu', () => {
    expect(usableFraction(15, 15)).toBeCloseTo(1 / 3, 10);
    expect(turnPressureForSpeeds(210, 15, 15)).toBeCloseTo(140, 8);
  });
  it('proud do jeskyně (ven pomaleji): použitelná je méně než třetina', () => {
    // dovnitř 20 m/min, ven 10 m/min → cesta ven dvakrát delší → 1 / (1 + 4) = pětina
    expect(usableFraction(20, 10)).toBeCloseTo(0.2, 10);
    expect(turnPressureForSpeeds(200, 20, 10)).toBeCloseTo(160, 8);
  });
  it('proud z jeskyně (ven rychleji): nikdy víc než třetina', () => {
    expect(usableFraction(10, 20)).toBeCloseTo(1 / 3, 10);
  });
  it('skútr 45 m/min a návrat plaváním 15 m/min: sedmina', () => {
    expect(usableFraction(45, 15)).toBeCloseTo(1 / 7, 10);
    expect(turnPressureForSpeeds(210, 45, 15)).toBeCloseTo(180, 8);
  });
  it('odmítne neplatné vstupy', () => {
    expect(() => usableFraction(0, 15)).toThrow(CalcInputError);
    expect(() => usableFraction(15, 0)).toThrow(CalcInputError);
    expect(() => turnPressureForSpeeds(-1, 15, 15)).toThrow(CalcInputError);
  });
});
