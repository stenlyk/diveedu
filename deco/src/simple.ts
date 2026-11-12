/**
 * Zkratky s číselnými argumenty pro lekce, kalkulačky a numerické otázky.
 * Kompartmenty se číslují 1–16 jako v literatuře. Jen pro výuku.
 */
import { AIR, CalcInputError } from '@diveedu/calc';
import { ambientBar, depthOfBar, TEACHING_ENV } from './model';
import { type EducationalPlan, noDecoLimit, planDive, type PlanGas } from './plan';
import { COMPARTMENTS, N2_A, N2_B, N2_HALF_TIMES } from './tables';

function index(compartment: number): number {
  if (!Number.isInteger(compartment) || compartment < 1 || compartment > COMPARTMENTS) throw new CalcInputError('kompartment musí být celé číslo 1–16');
  return compartment - 1;
}

/** Poločas dusíku v daném kompartmentu (min). */
export function n2HalfTime(compartment: number): number {
  return N2_HALF_TIMES[index(compartment)]!;
}

/** M-hodnota kompartmentu pro dusík při daném okolním tlaku: M = a + P / b. */
export function mValueN2(compartment: number, ambientPressureBar: number): number {
  const i = index(compartment);
  return N2_A[i]! + ambientPressureBar / N2_B[i]!;
}

/** Gradient factor v procentech: jak velkou část rozdílu mezi okolním tlakem a M-hodnotou tkáň čerpá. */
export function gradientPercentN2(compartment: number, tissueBar: number, ambientPressureBar: number): number {
  return ((tissueBar - ambientPressureBar) / (mValueN2(compartment, ambientPressureBar) - ambientPressureBar)) * 100;
}

/** Nejmenší hloubka (strop), kterou kompartment s daným tlakem dusíku snese při zvoleném GF. Nikdy záporná. */
export function ceilingDepthN2(compartment: number, tissueBar: number, gfPercent: number): number {
  const i = index(compartment);
  const gf = gfPercent / 100;
  if (!(gf > 0)) throw new CalcInputError('GF musí být kladný');
  const tolerated = (tissueBar - N2_A[i]! * gf) / (gf / N2_B[i]! - gf + 1);
  return Math.max(0, depthOfBar(tolerated, TEACHING_ENV));
}

/** Bezdekompresní limit (min) pro nitrox s danou frakcí kyslíku; GF low = GF high. */
export function ndlMinutes(depthM: number, fO2: number, gfPercent: number): number {
  return noDecoLimit({ depthM, gases: [{ gas: { fO2, fHe: 0 } }], gfLow: gfPercent, gfHigh: gfPercent });
}

function airPlan(depthM: number, bottomMinutes: number, gfLow: number, gfHigh: number, deco?: PlanGas): EducationalPlan {
  return planDive({ depthM, bottomMinutes, gases: deco ? [{ gas: AIR }, deco] : [{ gas: AIR }], gfLow, gfHigh });
}

/** Celková doba výstupu včetně zastávek pro ponor na vzduch (min). */
export function ascentMinutesAir(depthM: number, bottomMinutes: number, gfLow: number, gfHigh: number): number {
  return airPlan(depthM, bottomMinutes, gfLow, gfHigh).ascentMin;
}

/** Hloubka první zastávky pro ponor na vzduch (0 = bez zastávek). */
export function firstStopAir(depthM: number, bottomMinutes: number, gfLow: number, gfHigh: number): number {
  return airPlan(depthM, bottomMinutes, gfLow, gfHigh).firstStopM;
}

/** Doba výstupu pro ponor na vzduch s jedním dekompresním nitroxem (min). */
export function ascentMinutesWithDecoGas(depthM: number, bottomMinutes: number, gfLow: number, gfHigh: number, decoFO2: number, switchDepthM: number): number {
  return airPlan(depthM, bottomMinutes, gfLow, gfHigh, { gas: { fO2: decoFO2, fHe: 0 }, switchDepthM }).ascentMin;
}

/** Okolní tlak v hloubce ve výukové konvenci (pro úplnost rozhraní). */
export function ambientAt(depthM: number): number {
  return ambientBar(depthM, TEACHING_ENV);
}

/** Gradient factor v procentech z tlaku v tkáni, okolního tlaku a M-hodnoty. */
export function gradientPercent(tissueBar: number, ambientPressureBar: number, mValueBar: number): number {
  if (!(mValueBar > ambientPressureBar)) throw new CalcInputError('M-hodnota musí být vyšší než okolní tlak');
  return ((tissueBar - ambientPressureBar) / (mValueBar - ambientPressureBar)) * 100;
}

/**
 * Doba výstupu pro ponor na libovolné směsi (frakce kyslíku a helia) s jedním dekompresním nitroxem.
 * decoFO2 = 0 znamená bez dekompresního plynu.
 */
export function ascentMinutesMix(depthM: number, bottomMinutes: number, gfLow: number, gfHigh: number, fO2: number, fHe: number, decoFO2: number, switchDepthM: number): number {
  const gases: PlanGas[] = [{ gas: { fO2, fHe } }];
  if (decoFO2 > 0) gases.push({ gas: { fO2: decoFO2, fHe: 0 }, switchDepthM });
  return planDive({ depthM, bottomMinutes, gases, gfLow, gfHigh }).ascentMin;
}
