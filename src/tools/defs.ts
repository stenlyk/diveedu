/**
 * Definice kalkulaček a hraček. Každá jen popisuje vstupy a volá @diveedu/calc –
 * žádný výpočet se tu neodehrává. Stejná definice slouží jako hračka v lekci
 * i jako kalkulačka v Nástrojích (režimy „Spočti mi“ a „Spočítám sám“).
 */
import * as c from '@diveedu/calc';

export interface InputDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  initial: number;
  /** Převod zobrazené hodnoty na vstup výpočtu (procenta → frakce = 0.01). */
  scale?: number;
}

export interface OutputDef {
  label: string;
  /** null = hodnota mimo rozsah, zobrazí se note. */
  value: number | null;
  unit: string;
  decimals: number;
  tone?: 'ok' | 'warn' | 'danger';
  note?: string;
  /** Vodorovný ukazatel s vyznačenými limity. */
  bar?: { max: number; marks?: { at: number; label: string }[] };
}

export type Values = Record<string, number>;

export interface CalcDef {
  id: string;
  title: string;
  summary: string;
  inputs: InputDef[];
  outputs: (v: Values) => OutputDef[];
  /** Rozepsaný postup; kalkulačky s postupem mají i režim „Spočítám sám“. */
  steps?: (v: Values) => c.CalcStep[];
  /** Zobrazit v Nástrojích (jinak jen jako hračka v lekci). */
  tool?: boolean;
}

const pct = (key: string, label: string, min: number, max: number, initial: number): InputDef => ({ key, label, min, max, step: 1, unit: '%', initial, scale: 0.01 });
const depth = (initial = 30, max = 60, key = 'depth', label = 'Hloubka'): InputDef => ({ key, label, min: 0, max, step: 1, unit: 'm', initial });
const ppLimit = (initial = 1.4): InputDef => ({ key: 'limit', label: 'Limit ppO2', min: 1, max: 1.6, step: 0.1, unit: 'bar', initial });
const ppTone = (pp: number, limit: number): OutputDef['tone'] => (pp > limit + 1e-9 ? 'danger' : pp > limit - 0.1 ? 'warn' : 'ok');
const densityTone = (d: number): OutputDef['tone'] => ({ ok: 'ok', warning: 'warn', limit: 'danger' } as const)[c.densityRating(d)];
const DENSITY_MARKS = [{ at: c.DENSITY_RECOMMENDED_GL, label: '5,2' }, { at: c.DENSITY_HARD_LIMIT_GL, label: '6,2' }];

export const CALC_DEFS: CalcDef[] = [
  {
    id: 'boyle',
    title: 'Boyleův zákon',
    summary: 'Jak se změní objem plynu při změně hloubky.',
    tool: true,
    inputs: [
      { key: 'v1', label: 'Objem ve výchozí hloubce', min: 1, max: 20, step: 1, unit: 'l', initial: 6 },
      depth(20, 60, 'd1', 'Výchozí hloubka'),
      depth(0, 60, 'd2', 'Cílová hloubka'),
    ],
    outputs: (v) => [{ label: 'Objem v cílové hloubce', value: c.boyleVolume(v.v1!, v.d1!, v.d2!), unit: 'l', decimals: 1, bar: { max: 60 } }],
    steps: (v) => c.boyleSteps(v.v1!, v.d1!, v.d2!),
  },
  {
    id: 'air-density',
    title: 'Hustota vzduchu v hloubce',
    summary: 'Proč se v hloubce hůř dýchá.',
    inputs: [depth(30, 70)],
    outputs: (v) => {
      const d = c.airDensity(v.depth!);
      return [{ label: 'Hustota dýchaného vzduchu', value: d, unit: 'g/l', decimals: 2, tone: densityTone(d), bar: { max: 10, marks: DENSITY_MARKS }, note: 'Doporučený limit 5,2 g/l, tvrdý limit 6,2 g/l (Anthony & Mitchell, 2016).' }];
    },
  },
  {
    id: 'dalton',
    title: 'Parciální tlaky',
    summary: 'Rozklad okolního tlaku na kyslík a dusík.',
    inputs: [pct('fO2', 'Kyslík ve směsi', 21, 100, 21), depth(30)],
    outputs: (v) => {
      const p = c.absPressure(v.depth!);
      return [
        { label: 'Absolutní tlak', value: p, unit: 'bar', decimals: 1 },
        { label: 'ppO2', value: c.ppO2(v.fO2!, v.depth!), unit: 'bar', decimals: 2, tone: ppTone(c.ppO2(v.fO2!, v.depth!), 1.4), bar: { max: 7, marks: [{ at: 1.4, label: '1,4' }, { at: 1.6, label: '1,6' }] } },
        { label: 'ppN2', value: c.ppN2({ fO2: v.fO2!, fHe: 0 }, v.depth!), unit: 'bar', decimals: 2, bar: { max: 7 } },
      ];
    },
  },
  {
    id: 'henry',
    title: 'Sycení tkáně',
    summary: 'Jak rychle se tkáň dotahuje na tlak dusíku v okolí (vzduch).',
    inputs: [
      depth(30),
      { key: 'half', label: 'Poločas tkáně', min: 5, max: 120, step: 5, unit: 'min', initial: 20 },
      { key: 'minutes', label: 'Čas v hloubce', min: 0, max: 120, step: 5, unit: 'min', initial: 20 },
    ],
    outputs: (v) => {
      const ambient = c.ppN2(c.AIR, v.depth!);
      return [
        { label: 'ppN2 v dýchaném vzduchu', value: ambient, unit: 'bar', decimals: 2 },
        { label: 'Tlak dusíku v tkáni', value: c.haldaneTissuePressure(c.ppN2(c.AIR, 0), ambient, v.half!, v.minutes!), unit: 'bar', decimals: 2, bar: { max: 6 } },
        { label: 'Vyrovnáno z rozdílu', value: c.saturationFraction(v.half!, v.minutes!) * 100, unit: '%', decimals: 0, bar: { max: 100 } },
      ];
    },
  },
  {
    id: 'gay-lussac',
    title: 'Tlak v lahvi a teplota',
    summary: 'Proč po plnění tlak „spadne“.',
    tool: true,
    inputs: [
      { key: 'p1', label: 'Tlak po naplnění', min: 150, max: 300, step: 5, unit: 'bar', initial: 220 },
      { key: 't1', label: 'Teplota po naplnění', min: 10, max: 60, step: 1, unit: '°C', initial: 45 },
      { key: 't2', label: 'Teplota vody', min: 0, max: 30, step: 1, unit: '°C', initial: 8 },
    ],
    outputs: (v) => [{ label: 'Tlak po vychladnutí', value: c.gayLussacPressure(v.p1!, v.t1!, v.t2!), unit: 'bar', decimals: 0, bar: { max: 300 } }],
  },
  {
    id: 'buoyancy',
    title: 'Kolik váží plyn v lahvi',
    summary: 'O kolik jsi na konci ponoru lehčí.',
    inputs: [
      { key: 'tank', label: 'Objem lahví', min: 7, max: 30, step: 1, unit: 'l', initial: 24 },
      { key: 'start', label: 'Tlak na začátku', min: 100, max: 300, step: 10, unit: 'bar', initial: 200 },
      { key: 'end', label: 'Tlak na konci', min: 0, max: 200, step: 10, unit: 'bar', initial: 50 },
    ],
    outputs: (v) => [
      { label: 'Hmotnost vzduchu na začátku', value: c.gasMassKg(v.tank!, v.start!), unit: 'kg', decimals: 1 },
      { label: 'Hmotnost vzduchu na konci', value: c.gasMassKg(v.tank!, Math.min(v.end!, v.start!)), unit: 'kg', decimals: 1 },
      { label: 'O tolik jsi na konci lehčí', value: c.gasMassKg(v.tank!, v.start!) - c.gasMassKg(v.tank!, Math.min(v.end!, v.start!)), unit: 'kg', decimals: 1, bar: { max: 10 } },
    ],
  },
  {
    id: 'ears',
    title: 'Vzduch ve středouší',
    summary: 'Kolik objemu zbude, když nevyrovnáš tlak.',
    inputs: [depth(3, 20)],
    outputs: (v) => [
      { label: 'Objem vzduchu oproti hladině', value: c.boyleVolume(100, 0, v.depth!), unit: '%', decimals: 0, bar: { max: 100 } },
      { label: 'Tlakový rozdíl na bubínku bez vyrovnání', value: c.absPressure(v.depth!) - c.absPressure(0), unit: 'bar', decimals: 1, tone: v.depth! > 2 ? 'danger' : v.depth! > 0.5 ? 'warn' : 'ok' },
    ],
  },
  {
    id: 'nitrox-vs-air',
    title: 'Nitrox proti vzduchu',
    summary: 'Méně dusíku ve stejné hloubce.',
    inputs: [pct('fO2', 'Kyslík ve směsi', 21, 50, 32), depth(30, 50)],
    outputs: (v) => [
      { label: 'ppN2 na vzduchu', value: c.ppN2(c.AIR, v.depth!), unit: 'bar', decimals: 2, bar: { max: 5 } },
      { label: 'ppN2 na nitroxu', value: c.ppN2({ fO2: v.fO2!, fHe: 0 }, v.depth!), unit: 'bar', decimals: 2, bar: { max: 5 } },
      { label: 'ppO2 na nitroxu', value: c.ppO2(v.fO2!, v.depth!), unit: 'bar', decimals: 2, tone: ppTone(c.ppO2(v.fO2!, v.depth!), 1.4) },
    ],
  },
  {
    id: 'ppo2',
    title: 'ppO2',
    summary: 'Parciální tlak kyslíku směsi v hloubce.',
    tool: true,
    inputs: [pct('fO2', 'Kyslík ve směsi', 10, 100, 32), depth(30, 70)],
    outputs: (v) => {
      const pp = c.ppO2(v.fO2!, v.depth!);
      return [{ label: 'ppO2', value: pp, unit: 'bar', decimals: 2, tone: pp < 0.18 ? 'danger' : ppTone(pp, 1.4), bar: { max: 3, marks: [{ at: 1.4, label: '1,4' }, { at: 1.6, label: '1,6' }] }, note: pp < 0.18 ? 'Pod 0,18 bar hrozí hypoxie.' : 'Pracovní limit 1,4 bar, dekompresní 1,6 bar.' }];
    },
    steps: (v) => c.ppO2Steps(v.fO2!, v.depth!),
  },
  {
    id: 'mod',
    title: 'MOD',
    summary: 'Maximální operační hloubka směsi.',
    tool: true,
    inputs: [pct('fO2', 'Kyslík ve směsi', 21, 100, 32), ppLimit()],
    outputs: (v) => {
      const m = c.mod(v.fO2!, v.limit!);
      return [{ label: 'MOD (zaokrouhleno dolů)', value: c.floorTo(m), unit: 'm', decimals: 0, bar: { max: 70 }, note: `Přesně ${c.formatCs(m, 2)} m. MOD se vždy zaokrouhluje dolů.` }];
    },
    steps: (v) => c.modSteps(v.fO2!, v.limit!),
  },
  {
    id: 'best-mix',
    title: 'Best mix',
    summary: 'Nejbohatší nitrox pro plánovanou hloubku.',
    tool: true,
    inputs: [depth(30, 60), ppLimit()],
    outputs: (v) => {
      const f = c.bestMix(v.depth!, v.limit!);
      return [{ label: 'Nejvyšší podíl kyslíku (zaokrouhleno dolů)', value: c.floorTo(f * 100), unit: '%', decimals: 0, bar: { max: 100 }, note: `Přesně ${c.formatCs(f * 100, 1)} %. Podíl kyslíku se zaokrouhluje dolů.` }];
    },
    steps: (v) => c.bestMixSteps(v.depth!, v.limit!),
  },
  {
    id: 'ead',
    title: 'EAD',
    summary: 'Ekvivalentní vzduchová hloubka nitroxu.',
    tool: true,
    inputs: [pct('fO2', 'Kyslík ve směsi', 21, 50, 32), depth(30, 50)],
    outputs: (v) => [{ label: 'EAD', value: c.ead(v.fO2!, v.depth!), unit: 'm', decimals: 1, bar: { max: 50 }, note: 'Hloubka, ve které bys na vzduchu dýchal stejné ppN2.' }],
    steps: (v) => c.eadSteps(v.fO2!, v.depth!),
  },
  {
    id: 'cns',
    title: 'CNS hodiny',
    summary: 'Podíl vyčerpaného limitu NOAA pro jednu expozici.',
    tool: true,
    inputs: [
      { key: 'pp', label: 'ppO2', min: 0.6, max: 1.6, step: 0.05, unit: 'bar', initial: 1.4 },
      { key: 'minutes', label: 'Čas', min: 0, max: 240, step: 5, unit: 'min', initial: 30 },
    ],
    outputs: (v) => {
      const percent = c.cnsPercent(v.pp!, v.minutes!);
      return [
        { label: 'Limit jedné expozice', value: c.cnsLimitMinutes(v.pp!), unit: 'min', decimals: 0 },
        { label: 'CNS', value: percent, unit: '%', decimals: 0, tone: percent === null || percent > 100 ? 'danger' : percent > 80 ? 'warn' : 'ok', bar: { max: 120, marks: [{ at: 80, label: '80' }, { at: 100, label: '100' }] } },
      ];
    },
    steps: (v) => c.cnsSteps(v.pp!, v.minutes!),
  },
  {
    id: 'otu',
    title: 'OTU',
    summary: 'Jednotky plicní kyslíkové toxicity.',
    tool: true,
    inputs: [
      { key: 'pp', label: 'ppO2', min: 0.5, max: 1.6, step: 0.05, unit: 'bar', initial: 1.4 },
      { key: 'minutes', label: 'Čas', min: 0, max: 300, step: 5, unit: 'min', initial: 30 },
    ],
    outputs: (v) => [{ label: 'OTU', value: c.otu(v.pp!, v.minutes!), unit: 'OTU', decimals: 0, bar: { max: 850 } }],
    steps: (v) => c.otuSteps(v.pp!, v.minutes!),
  },
  {
    id: 'blend',
    title: 'Míchání nitroxu',
    summary: 'Parciální tlaky pro plnění prázdné lahve: kyslík, pak vzduch.',
    tool: true,
    inputs: [
      { key: 'target', label: 'Cílový tlak', min: 100, max: 300, step: 10, unit: 'bar', initial: 200 },
      pct('fO2', 'Cílový podíl kyslíku', 22, 80, 32),
    ],
    outputs: (v) => {
      const blend = c.partialPressureBlend({ startBar: 0, targetBar: v.target!, targetGas: { fO2: v.fO2!, fHe: 0 } });
      return [
        { label: 'Kyslík (plní se první)', value: blend.o2Bar, unit: 'bar', decimals: 1 },
        { label: 'Vzduch (doplnit do cílového tlaku)', value: blend.topBar, unit: 'bar', decimals: 1, note: 'Ideální plyn. Skutečný výsledek vždy ověř analýzou.' },
      ];
    },
    steps: (v) => c.nitroxBlendSteps(v.target!, v.fO2!),
  },
  {
    id: 'top-up',
    title: 'Doplnění zbytku vzduchem',
    summary: 'Jaká směs vznikne, když zbytek nitroxu doplníš vzduchem.',
    tool: true,
    inputs: [
      { key: 'start', label: 'Tlak zbytku', min: 0, max: 200, step: 10, unit: 'bar', initial: 60 },
      pct('fO2', 'Kyslík ve zbytku', 21, 100, 32),
      { key: 'end', label: 'Tlak po doplnění', min: 100, max: 300, step: 10, unit: 'bar', initial: 200 },
    ],
    outputs: (v) => {
      const gas = c.topUp({ startBar: Math.min(v.start!, v.end!), startGas: { fO2: v.fO2!, fHe: 0 }, endBar: v.end! });
      return [{ label: 'Výsledný podíl kyslíku', value: gas.fO2 * 100, unit: '%', decimals: 1, bar: { max: 100 }, note: `MOD při 1,4 bar: ${c.formatCs(c.floorTo(c.mod(gas.fO2, 1.4)), 0)} m.` }];
    },
  },
  {
    id: 'adiabatic',
    title: 'Ohřátí plynu při rychlém stlačení',
    summary: 'Proč se kyslíkové ventily otevírají pomalu.',
    inputs: [{ key: 'p2', label: 'Tlak, na který plyn prudce vystoupá', min: 10, max: 300, step: 10, unit: 'bar', initial: 200 }],
    outputs: (v) => {
      const t = c.adiabaticTempC(20, 1, v.p2!);
      return [{ label: 'Teoretická teplota plynu (z 20 °C)', value: t, unit: '°C', decimals: 0, tone: t > 400 ? 'danger' : 'warn', bar: { max: 1200 }, note: 'Ideální horní mez bez odvodu tepla. V čistém kyslíku stačí řádově nižší teplota k zapálení mastnoty nebo těsnění.' }];
    },
  },
  {
    id: 'label',
    title: 'Štítek na lahvi',
    summary: 'Co musí být na lahvi po analýze.',
    inputs: [{ key: 'o2', label: 'Naměřený kyslík', min: 21, max: 100, step: 0.5, unit: '%', initial: 32.5, scale: 0.01 }],
    outputs: (v) => [
      { label: 'MOD při 1,4 bar (pracovní)', value: c.floorTo(c.mod(v.o2!, 1.4)), unit: 'm', decimals: 0 },
      { label: 'MOD při 1,6 bar (dekomprese)', value: c.floorTo(c.mod(v.o2!, 1.6)), unit: 'm', decimals: 0, note: 'Na štítek patří: naměřený podíl O2, MOD, datum a podpis toho, kdo měřil a kdo bude z lahve dýchat.' },
    ],
  },
];

export const calcDefsById = new Map(CALC_DEFS.map((def) => [def.id, def]));

/** Výchozí hodnoty vstupů ve škále výpočtu. */
export function initialValues(def: CalcDef): Values {
  return Object.fromEntries(def.inputs.map((input) => [input.key, input.initial]));
}

/** Zobrazené hodnoty → vstupy výpočtu (procenta na frakce). */
export function toCalcValues(def: CalcDef, shown: Values): Values {
  return Object.fromEntries(def.inputs.map((input) => [input.key, Number((shown[input.key]! * (input.scale ?? 1)).toFixed(6))]));
}

/** Tolerance vlastního výpočtu podle jednotky (SPEC: ±1 m, ±0,02 bar). */
export function stepTolerance(step: c.CalcStep): number {
  switch (step.unit) {
    case 'bar': return step.value > 20 ? 1 : 0.02;
    case 'm': return 1;
    case '': return 0.01;
    case 'g/l': return 0.05;
    case '%': case 'OTU': case 'min': return 1;
    default: return Math.max(0.1, Math.abs(step.value) * 0.01);
  }
}
