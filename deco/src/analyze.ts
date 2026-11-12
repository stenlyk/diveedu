/**
 * Rozbor výukového plánu: kyslík, narkóza, hustota, izobarická protidifuze a strop.
 * Všechny veličiny počítá @diveedu/calc; tady se jen procházejí vzorky plánu.
 */
import { cnsPercent, end, gasDensity, icdCheck, otu, ppO2 } from '@diveedu/calc';
import type { EducationalPlan, PlanGas } from './plan';

export interface PlanLimits {
  ppO2MaxBar: number;
  /** Limit ppO2 pro dekompresní a travel plyny (v klidu). */
  ppO2DecoMaxBar: number;
  ppO2MinBar: number;
  endMaxM: number;
  densityMaxGL: number;
}

export const DEFAULT_PLAN_LIMITS: PlanLimits = Object.freeze({ ppO2MaxBar: 1.4, ppO2DecoMaxBar: 1.6, ppO2MinBar: 0.18, endMaxM: 30, densityMaxGL: 6.2 });

export interface GasSwitch {
  t: number;
  depthM: number;
  fromIndex: number;
  toIndex: number;
  /** Výsledek pravidla pětin (izobarická protidifuze). */
  icdOk: boolean;
}

export type PlanIssue =
  | { kind: 'ppo2-high'; depthM: number; gasIndex: number; value: number }
  | { kind: 'hypoxic'; depthM: number; gasIndex: number; value: number }
  | { kind: 'end'; depthM: number; gasIndex: number; value: number }
  | { kind: 'density'; depthM: number; gasIndex: number; value: number }
  | { kind: 'icd'; depthM: number; gasIndex: number; value: number }
  | { kind: 'cns'; value: number }
  | { kind: 'cns-off-table' }
  | { kind: 'ceiling'; depthM: number; value: number };

export interface PlanAnalysis {
  maxPpO2Bar: number;
  minPpO2Bar: number;
  maxEndM: number;
  maxDensityGL: number;
  /** null = některý úsek je nad rozsahem tabulky NOAA (ppO2 přes 1,6 bar). */
  cnsPercent: number | null;
  otu: number;
  switches: GasSwitch[];
  issues: PlanIssue[];
}

export function analyzePlan(plan: EducationalPlan, gases: readonly PlanGas[], limits: PlanLimits = DEFAULT_PLAN_LIMITS): PlanAnalysis {
  const worst = new Map<string, PlanIssue>();
  /** U každého druhu problému a plynu se ponechá jen nejhorší výskyt. */
  const note = (key: string, issue: PlanIssue & { value: number }, higherIsWorse = true) => {
    const previous = worst.get(key) as (PlanIssue & { value: number }) | undefined;
    if (!previous || (higherIsWorse ? issue.value > previous.value : issue.value < previous.value)) worst.set(key, issue);
  };

  let maxPpO2Bar = 0;
  let minPpO2Bar = Infinity;
  let maxEndM = 0;
  let maxDensityGL = 0;
  let cns: number | null = 0;
  let otuTotal = 0;
  const switches: GasSwitch[] = [];

  plan.samples.forEach((sample, i) => {
    const previous = plan.samples[i - 1];
    const gas = gases[sample.gasIndex]!.gas;
    const pp = ppO2(gas.fO2, sample.depthM);
    const endM = end(gas, sample.depthM);
    const density = gasDensity(gas, sample.depthM);
    maxPpO2Bar = Math.max(maxPpO2Bar, pp);
    minPpO2Bar = Math.min(minPpO2Bar, pp);
    maxEndM = Math.max(maxEndM, endM);
    maxDensityGL = Math.max(maxDensityGL, density);

    const ppLimit = sample.gasIndex === 0 ? limits.ppO2MaxBar : limits.ppO2DecoMaxBar;
    if (pp > ppLimit + 1e-6) note(`ppo2-${sample.gasIndex}`, { kind: 'ppo2-high', depthM: sample.depthM, gasIndex: sample.gasIndex, value: pp });
    if (pp < limits.ppO2MinBar - 1e-6) note(`hypoxic-${sample.gasIndex}`, { kind: 'hypoxic', depthM: sample.depthM, gasIndex: sample.gasIndex, value: pp }, false);
    if (endM > limits.endMaxM + 1e-6) note(`end-${sample.gasIndex}`, { kind: 'end', depthM: sample.depthM, gasIndex: sample.gasIndex, value: endM });
    if (density > limits.densityMaxGL + 1e-6) note(`density-${sample.gasIndex}`, { kind: 'density', depthM: sample.depthM, gasIndex: sample.gasIndex, value: density });
    if (sample.depthM < sample.ceilingM - 1e-4) note('ceiling', { kind: 'ceiling', depthM: sample.depthM, value: sample.ceilingM - sample.depthM });

    if (!previous) return;
    if (previous.gasIndex !== sample.gasIndex) {
      const check = icdCheck(gases[previous.gasIndex]!.gas, gas);
      switches.push({ t: sample.t, depthM: sample.depthM, fromIndex: previous.gasIndex, toIndex: sample.gasIndex, icdOk: check.ok });
      if (!check.ok) note(`icd-${sample.gasIndex}`, { kind: 'icd', depthM: sample.depthM, gasIndex: sample.gasIndex, value: check.deltaN2 });
      return;
    }
    // Kyslíková zátěž úseku se počítá průměrným ppO2 mezi dvěma vzorky.
    const minutes = sample.t - previous.t;
    const mean = (pp + ppO2(gas.fO2, previous.depthM)) / 2;
    otuTotal += otu(mean, minutes);
    const part = cnsPercent(mean, minutes);
    cns = cns === null || part === null ? null : cns + part;
  });

  const issues = [...worst.values()];
  if (cns === null) issues.push({ kind: 'cns-off-table' });
  else if (cns > 80) issues.push({ kind: 'cns', value: cns });
  return { maxPpO2Bar, minPpO2Bar, maxEndM, maxDensityGL, cnsPercent: cns, otu: otuTotal, switches, issues };
}
