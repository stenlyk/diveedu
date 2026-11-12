import { DENSITY_HE, DENSITY_N2, DENSITY_O2, gasDensity, surfaceDensity } from './density';
import { formatCs } from './format';
import { AIR_FN2, fN2, type Gas } from './gas';
import { ead, end } from './narcosis';
import { bestMix, cnsLimitMinutes, mod, otu, ppO2 } from './oxygen';
import { absPressure, boyleVolume } from './pressure';
import { gasConsumed } from './consumption';
import { partialPressureBlend } from './blending';
import { CalcInputError } from './errors';

/** Jeden krok rozepsaného postupu výpočtu (metrická konvence 10 m = 1 bar). */
export interface CalcStep {
  label: string;
  /** Vzorec s dosazenými čísly, bez výsledku. */
  latex: string;
  value: number;
  unit: string;
}

/** Číslo pro LaTeX s českou desetinnou čárkou. */
export function tex(value: number, decimals = 2): string {
  const formatted = formatCs(value, decimals);
  const trimmed = formatted.includes(',') ? formatted.replace(/0+$/, '').replace(/,$/, '') : formatted;
  return trimmed.replace(',', '{,}');
}

/** Výsledek kroku se jednotkou pro LaTeX; znak % je v LaTeXu komentář a musí se escapovat. */
export function texResult(value: number, unit: string, decimals = 3): string {
  const escaped = unit.replace(/%/g, '\\%');
  return `${tex(value, decimals)}${unit ? `\\ \\text{${escaped}}` : ''}`;
}

function pressureStep(depthM: number): CalcStep {
  return {
    label: 'Absolutní tlak v hloubce',
    latex: `P_{abs} = \\frac{${tex(depthM)}}{10} + 1`,
    value: absPressure(depthM),
    unit: 'bar',
  };
}

export function absPressureSteps(depthM: number): CalcStep[] {
  return [pressureStep(depthM)];
}

export function ppO2Steps(fO2: number, depthM: number): CalcStep[] {
  const p = absPressure(depthM);
  return [
    pressureStep(depthM),
    {
      label: 'Parciální tlak kyslíku',
      latex: `ppO_2 = F_{O_2} \\cdot P_{abs} = ${tex(fO2)} \\cdot ${tex(p)}`,
      value: ppO2(fO2, depthM),
      unit: 'bar',
    },
  ];
}

export function modSteps(fO2: number, ppO2MaxBar: number): CalcStep[] {
  const p = ppO2MaxBar / fO2;
  return [
    {
      label: 'Tlak, při kterém směs dosáhne limitu ppO2',
      latex: `P_{abs} = \\frac{ppO_{2,max}}{F_{O_2}} = \\frac{${tex(ppO2MaxBar)}}{${tex(fO2)}}`,
      value: p,
      unit: 'bar',
    },
    {
      label: 'Převod tlaku na hloubku',
      latex: `MOD = (P_{abs} - 1) \\cdot 10 = (${tex(p, 3)} - 1) \\cdot 10`,
      value: mod(fO2, ppO2MaxBar),
      unit: 'm',
    },
  ];
}

export function bestMixSteps(depthM: number, ppO2MaxBar: number): CalcStep[] {
  const p = absPressure(depthM);
  return [
    pressureStep(depthM),
    {
      label: 'Nejvyšší frakce kyslíku pro limit ppO2',
      latex: `F_{O_2} = \\frac{ppO_{2,max}}{P_{abs}} = \\frac{${tex(ppO2MaxBar)}}{${tex(p)}}`,
      value: bestMix(depthM, ppO2MaxBar),
      unit: '',
    },
  ];
}

export function eadSteps(fO2: number, depthM: number): CalcStep[] {
  const ratio = (1 - fO2) / AIR_FN2;
  return [
    {
      label: 'Poměr dusíku ve směsi a ve vzduchu',
      latex: `\\frac{1 - F_{O_2}}{0{,}79} = \\frac{${tex(1 - fO2)}}{0{,}79}`,
      value: ratio,
      unit: '',
    },
    {
      label: 'Ekvivalentní vzduchová hloubka',
      latex: `EAD = ${tex(ratio, 3)} \\cdot (${tex(depthM)} + 10) - 10`,
      value: ead(fO2, depthM),
      unit: 'm',
    },
  ];
}

export function endSteps(gas: Gas, depthM: number, o2Narcotic = true): CalcStep[] {
  const fraction = o2Narcotic ? 1 - gas.fHe : fN2(gas) / AIR_FN2;
  return [
    {
      label: o2Narcotic
        ? 'Narkotická část směsi (dusík + kyslík)'
        : 'Poměr dusíku ve směsi a ve vzduchu',
      latex: o2Narcotic
        ? `1 - F_{He} = 1 - ${tex(gas.fHe)}`
        : `\\frac{F_{N_2}}{0{,}79} = \\frac{${tex(fN2(gas))}}{0{,}79}`,
      value: fraction,
      unit: '',
    },
    {
      label: 'Ekvivalentní narkotická hloubka',
      latex: `END = ${tex(fraction, 3)} \\cdot (${tex(depthM)} + 10) - 10`,
      value: end(gas, depthM, { o2Narcotic }),
      unit: 'm',
    },
  ];
}

export function gasDensitySteps(gas: Gas, depthM: number): CalcStep[] {
  const surface = surfaceDensity(gas);
  const p = absPressure(depthM);
  return [
    {
      label: 'Hustota směsi na hladině',
      latex: `\\rho_0 = ${tex(DENSITY_O2, 3)} \\cdot ${tex(gas.fO2)} + ${tex(DENSITY_N2, 3)} \\cdot ${tex(fN2(gas))} + ${tex(DENSITY_HE, 3)} \\cdot ${tex(gas.fHe)}`,
      value: surface,
      unit: 'g/l',
    },
    pressureStep(depthM),
    {
      label: 'Hustota v hloubce',
      latex: `\\rho = P_{abs} \\cdot \\rho_0 = ${tex(p)} \\cdot ${tex(surface, 3)}`,
      value: gasDensity(gas, depthM),
      unit: 'g/l',
    },
  ];
}

export function otuSteps(ppO2Bar: number, minutes: number): CalcStep[] {
  const base = Math.max(0, (ppO2Bar - 0.5) / 0.5);
  return [
    {
      label: 'Základ: o kolik ppO2 převyšuje 0,5 bar',
      latex: `\\frac{ppO_2 - 0{,}5}{0{,}5} = \\frac{${tex(ppO2Bar)} - 0{,}5}{0{,}5}`,
      value: base,
      unit: '',
    },
    {
      label: 'Jednotky plicní toxicity',
      latex: `OTU = t \\cdot ${tex(base, 3)}^{0{,}83} = ${tex(minutes)} \\cdot ${tex(base, 3)}^{0{,}83}`,
      value: otu(ppO2Bar, minutes),
      unit: 'OTU',
    },
  ];
}

export function gasConsumedSteps(sacLpm: number, depthM: number, minutes: number): CalcStep[] {
  const p = absPressure(depthM);
  return [
    pressureStep(depthM),
    {
      label: 'Spotřeba plynu',
      latex: `V = SAC \\cdot P_{abs} \\cdot t = ${tex(sacLpm)} \\cdot ${tex(p)} \\cdot ${tex(minutes)}`,
      value: gasConsumed(sacLpm, depthM, minutes),
      unit: 'l',
    },
  ];
}

export function boyleSteps(volume1L: number, depth1M: number, depth2M: number): CalcStep[] {
  const p1 = absPressure(depth1M);
  const p2 = absPressure(depth2M);
  return [
    { label: 'Tlak ve výchozí hloubce', latex: `P_1 = \\frac{${tex(depth1M)}}{10} + 1`, value: p1, unit: 'bar' },
    { label: 'Tlak v cílové hloubce', latex: `P_2 = \\frac{${tex(depth2M)}}{10} + 1`, value: p2, unit: 'bar' },
    {
      label: 'Objem po změně hloubky',
      latex: `V_2 = V_1 \\cdot \\frac{P_1}{P_2} = ${tex(volume1L)} \\cdot \\frac{${tex(p1)}}{${tex(p2)}}`,
      value: boyleVolume(volume1L, depth1M, depth2M),
      unit: 'l',
    },
  ];
}

/** Postup CNS %; jen pro ppO2 v rozsahu tabulky NOAA nad 0,5 bar. */
export function cnsSteps(ppO2Bar: number, minutes: number): CalcStep[] {
  const limit = cnsLimitMinutes(ppO2Bar);
  if (limit === null || !Number.isFinite(limit)) {
    throw new CalcInputError('postup CNS jde rozepsat jen pro ppO2 nad 0,5 a do 1,6 bar');
  }
  return [
    {
      label: 'Limit jedné expozice z tabulky NOAA',
      latex: `t_{max}(${tex(ppO2Bar)}\\ \\text{bar})`,
      value: limit,
      unit: 'min',
    },
    {
      label: 'Podíl vyčerpaného limitu',
      latex: `CNS = \\frac{t}{t_{max}} \\cdot 100 = \\frac{${tex(minutes)}}{${tex(limit, 1)}} \\cdot 100`,
      value: (minutes / limit) * 100,
      unit: '%',
    },
  ];
}

/** Míchání nitroxu parciálním tlakem do prázdné lahve: kolik vzduchu a kolik kyslíku. */
export function nitroxBlendSteps(targetBar: number, targetFO2: number): CalcStep[] {
  const blend = partialPressureBlend({ startBar: 0, targetBar, targetGas: { fO2: targetFO2, fHe: 0 } });
  return [
    {
      label: 'Dusík je jen ve vzduchu – kolik barů vzduchu je potřeba',
      latex: `P_{vzduch} = \\frac{P \\cdot (1 - F_{O_2})}{0{,}79} = \\frac{${tex(targetBar)} \\cdot ${tex(1 - targetFO2)}}{0{,}79}`,
      value: blend.topBar,
      unit: 'bar',
    },
    {
      label: 'Zbytek do cílového tlaku je čistý kyslík',
      latex: `P_{O_2} = P - P_{vzduch} = ${tex(targetBar)} - ${tex(blend.topBar, 1)}`,
      value: blend.o2Bar,
      unit: 'bar',
    },
  ];
}
