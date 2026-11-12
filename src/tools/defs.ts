/**
 * Definice kalkulaček a hraček. Každá jen popisuje vstupy a volá @diveedu/calc –
 * žádný výpočet se tu neodehrává. Stejná definice slouží jako hračka v lekci
 * i jako kalkulačka v Nástrojích (režimy „Spočti mi“ a „Spočítám sám“).
 */
import * as c from '@diveedu/calc';
import * as d from '@diveedu/deco';

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
  // ── Modul 2: plánování plynu a dekomprese ──────────────────────────────────
  {
    id: 'consumption',
    title: 'Spotřeba plynu',
    summary: 'Kolik plynu spotřebuješ v hloubce a kolik je to na manometru.',
    tool: true,
    inputs: [
      { key: 'sac', label: 'Povrchová spotřeba (SAC)', min: 10, max: 40, step: 1, unit: 'l/min', initial: 20 },
      depth(30, 70),
      { key: 'minutes', label: 'Čas', min: 1, max: 60, step: 1, unit: 'min', initial: 20 },
      { key: 'tank', label: 'Objem lahví', min: 7, max: 30, step: 1, unit: 'l', initial: 24 },
    ],
    outputs: (v) => {
      const liters = c.gasConsumed(v.sac!, v.depth!, v.minutes!);
      return [
        { label: 'Spotřeba', value: liters, unit: 'l', decimals: 0 },
        { label: 'Úbytek na manometru', value: c.ceilTo(c.litersToBar(liters, v.tank!)), unit: 'bar', decimals: 0, bar: { max: 232 }, note: `${c.formatCs(c.sacBarPerMinute(v.sac!, v.depth!, v.tank!), 1)} bar za minutu. Zaokrouhleno nahoru.` },
      ];
    },
    steps: (v) => c.gasConsumedSteps(v.sac!, v.depth!, v.minutes!),
  },
  {
    id: 'sac-log',
    title: 'SAC z ponoru',
    summary: 'Povrchová spotřeba spočítaná z poklesu tlaku.',
    tool: true,
    inputs: [
      { key: 'start', label: 'Tlak na začátku', min: 150, max: 300, step: 5, unit: 'bar', initial: 200 },
      { key: 'used', label: 'Spotřebováno', min: 10, max: 150, step: 5, unit: 'bar', initial: 100 },
      { key: 'tank', label: 'Objem lahví', min: 7, max: 30, step: 1, unit: 'l', initial: 12 },
      depth(20, 60, 'depth', 'Průměrná hloubka'),
      { key: 'minutes', label: 'Čas', min: 5, max: 90, step: 5, unit: 'min', initial: 40 },
    ],
    outputs: (v) => [{ label: 'SAC', value: c.sacFromPressureDrop(v.start!, v.start! - v.used!, v.tank!, v.depth!, v.minutes!), unit: 'l/min', decimals: 1, bar: { max: 40 }, note: 'Klidná spotřeba. Pro rezervy se počítá se stresovou, obvykle dvojnásobnou.' }],
    steps: (v) => c.sacSteps(v.start!, v.start! - v.used!, v.tank!, v.depth!, v.minutes!),
  },
  {
    id: 'rock-bottom',
    title: 'Minimum gas (rock bottom)',
    summary: 'Rezerva, která dostane dva potápěče z nejhlubšího bodu na hladinu.',
    tool: true,
    inputs: [
      depth(30, 60),
      { key: 'sac', label: 'Stresová spotřeba jednoho potápěče', min: 15, max: 45, step: 5, unit: 'l/min', initial: 20 },
      { key: 'tank', label: 'Objem lahví', min: 10, max: 30, step: 1, unit: 'l', initial: 24 },
    ],
    outputs: (v) => [
      { label: 'Rezerva v litrech', value: c.rockBottomLiters(v.depth!, v.sac!), unit: 'l', decimals: 0 },
      { label: 'Rezerva na manometru (nahoru na 10 bar)', value: c.ceilTo(c.rockBottomBar(v.depth!, v.sac!, v.tank!), 10), unit: 'bar', decimals: 0, bar: { max: 232 }, note: 'Dva potápěči, 1 min řešení v hloubce, výstup 9 m/min bez zastávek. Konvence agentur se liší; zastávky a dekomprese se připočítávají.' },
    ],
    steps: (v) => c.rockBottomSteps(v.depth!, v.sac!, v.tank!),
  },
  {
    id: 'thirds',
    title: 'Pravidlo třetin',
    summary: 'Kdy otočit ponor, ze kterého není přímá cesta na hladinu.',
    tool: true,
    inputs: [{ key: 'start', label: 'Tlak na začátku', min: 150, max: 300, step: 5, unit: 'bar', initial: 200 }],
    outputs: (v) => {
      const thirds = c.ruleOfThirdsPractical(v.start!);
      return [
        { label: 'Plyn na cestu tam', value: thirds.usableBar, unit: 'bar', decimals: 0 },
        { label: 'Tlak otočky', value: thirds.turnBar, unit: 'bar', decimals: 0, bar: { max: 300 }, note: 'Třetina se zaokrouhluje dolů na celé desítky barů.' },
      ];
    },
  },
  {
    id: 'team-turn',
    title: 'Otočka dvojice',
    summary: 'Tlak otočky pro dva potápěče s různými lahvemi nebo spotřebou.',
    tool: true,
    inputs: [
      { key: 'start', label: 'Tlak obou na začátku', min: 150, max: 300, step: 10, unit: 'bar', initial: 200 },
      { key: 'tankA', label: 'Lahve potápěče A', min: 10, max: 30, step: 1, unit: 'l', initial: 24 },
      { key: 'sacA', label: 'SAC potápěče A', min: 10, max: 35, step: 1, unit: 'l/min', initial: 20 },
      { key: 'tankB', label: 'Lahve potápěče B', min: 10, max: 30, step: 1, unit: 'l', initial: 15 },
      { key: 'sacB', label: 'SAC potápěče B', min: 10, max: 35, step: 1, unit: 'l/min', initial: 15 },
    ],
    outputs: (v) => {
      const turn = c.teamTurnPressure({ tankLiters: v.tankA!, startBar: v.start!, sacLpm: v.sacA! }, { tankLiters: v.tankB!, startBar: v.start!, sacLpm: v.sacB! });
      return [
        { label: 'Otočka potápěče A', value: c.ceilTo(turn.a.turnBar, 5), unit: 'bar', decimals: 0, tone: turn.limitedBy === 'a' ? 'warn' : undefined },
        { label: 'Otočka potápěče B', value: c.ceilTo(turn.b.turnBar, 5), unit: 'bar', decimals: 0, tone: turn.limitedBy === 'b' ? 'warn' : undefined, note: `Ponor otáčí potápěč ${turn.limitedBy.toUpperCase()}. Nikdo nepoužije víc než svou třetinu a rezerva každého stačí na cestu ven pro oba.` },
      ];
    },
  },
  {
    id: 'm-value',
    title: 'M-hodnota kompartmentu',
    summary: 'Kolik dusíku tkáň snese v dané hloubce.',
    inputs: [
      { key: 'comp', label: 'Kompartment', min: 1, max: 16, step: 1, unit: '', initial: 5 },
      depth(0, 40),
    ],
    outputs: (v) => {
      const ambient = c.absPressure(v.depth!);
      const m = d.mValueN2(v.comp!, ambient);
      return [
        { label: 'Poločas kompartmentu', value: d.n2HalfTime(v.comp!), unit: 'min', decimals: 1 },
        { label: 'Okolní tlak', value: ambient, unit: 'bar', decimals: 1 },
        { label: 'M-hodnota (nejvyšší tolerovaný tlak dusíku)', value: m, unit: 'bar', decimals: 2, bar: { max: 9 }, note: `Povolené přesycení nad okolní tlak: ${c.formatCs(m - ambient, 2)} bar. Rychlé kompartmenty snesou víc.` },
      ];
    },
  },
  {
    id: 'ndl',
    title: 'Bezdekompresní limit',
    summary: 'Jak dlouho lze zůstat bez zastávek – podle modelu a zvoleného GF.',
    inputs: [depth(30, 45), pct('fO2', 'Kyslík ve směsi', 21, 40, 21), { key: 'gf', label: 'Gradient factor', min: 50, max: 100, step: 5, unit: '%', initial: 85 }],
    outputs: (v) => [{ label: 'Bezdekompresní limit', value: d.ndlMinutes(Math.max(v.depth!, 6), v.fO2!, v.gf!), unit: 'min', decimals: 0, bar: { max: 120 }, note: 'Výukový model ZHL-16C. Skutečný počítač může ukázat jinou hodnotu – má jiné konvence a zná tvůj předchozí ponor.' }],
  },
  {
    id: 'gf-plan',
    title: 'Gradient factors a tvar dekomprese',
    summary: 'Jak GF low a GF high mění první zastávku a délku výstupu (vzduch).',
    inputs: [
      depth(45, 60),
      { key: 'bottom', label: 'Čas na dně', min: 10, max: 40, step: 5, unit: 'min', initial: 25 },
      { key: 'low', label: 'GF low', min: 10, max: 100, step: 5, unit: '%', initial: 30 },
      { key: 'high', label: 'GF high', min: 50, max: 100, step: 5, unit: '%', initial: 85 },
    ],
    outputs: (v) => {
      const low = Math.min(v.low!, v.high!);
      const depthM = Math.max(v.depth!, 18);
      return [
        { label: 'První zastávka', value: d.firstStopAir(depthM, v.bottom!, low, v.high!), unit: 'm', decimals: 0, bar: { max: 40 } },
        { label: 'Doba výstupu včetně zastávek', value: d.ascentMinutesAir(depthM, v.bottom!, low, v.high!), unit: 'min', decimals: 0, bar: { max: 150 }, note: 'GF low určuje, kde dekomprese začne. GF high určuje, s jakým přesycením vylezeš z vody.' },
      ];
    },
  },
  {
    id: 'deco-gas',
    title: 'Vliv dekompresního plynu',
    summary: 'O kolik zkrátí výstup bohatá směs (dno na vzduchu, GF 30/85).',
    inputs: [
      depth(45, 60),
      { key: 'bottom', label: 'Čas na dně', min: 10, max: 40, step: 5, unit: 'min', initial: 25 },
      pct('fO2', 'Kyslík v dekompresním plynu', 32, 100, 50),
    ],
    outputs: (v) => {
      const depthM = Math.max(v.depth!, 18);
      const switchDepth = c.floorTo(Math.min(c.mod(v.fO2!, 1.6), depthM), 3);
      const air = d.ascentMinutesAir(depthM, v.bottom!, 30, 85);
      const mixed = d.ascentMinutesWithDecoGas(depthM, v.bottom!, 30, 85, v.fO2!, switchDepth);
      return [
        { label: 'Hloubka přepnutí (MOD při 1,6 bar, na zastávku)', value: switchDepth, unit: 'm', decimals: 0 },
        { label: 'Výstup jen na vzduchu', value: air, unit: 'min', decimals: 0, bar: { max: 150 } },
        { label: 'Výstup s dekompresním plynem', value: mixed, unit: 'min', decimals: 0, tone: 'ok', bar: { max: 150 } },
      ];
    },
  },
  // ── Modul 3: trimix ────────────────────────────────────────────────────────
  {
    id: 'end',
    title: 'END trimixu',
    summary: 'Ekvivalentní narkotická hloubka v obou variantách – s narkotickým kyslíkem i bez.',
    tool: true,
    inputs: [pct('fO2', 'Kyslík', 8, 40, 18), pct('fHe', 'Helium', 0, 90, 45), depth(60, 100)],
    outputs: (v) => {
      const fHe = Math.min(v.fHe!, 1 - v.fO2!);
      const narcotic = c.endOfMix(v.fO2!, fHe, v.depth!);
      return [
        { label: 'END, kyslík narkotický', value: narcotic, unit: 'm', decimals: 1, tone: narcotic > 40 ? 'danger' : narcotic > 30 ? 'warn' : 'ok', bar: { max: 100, marks: [{ at: 30, label: '30' }] } },
        { label: 'END, narkotický jen dusík', value: c.endOfMixN2Only(v.fO2!, fHe, v.depth!), unit: 'm', decimals: 1, bar: { max: 100, marks: [{ at: 30, label: '30' }] }, note: 'Agentury se liší v tom, zda kyslík počítají jako narkotický. Konzervativnější je první varianta.' },
      ];
    },
    steps: (v) => c.endOfMixSteps(v.fO2!, Math.min(v.fHe!, 1 - v.fO2!), v.depth!),
  },
  {
    id: 'density',
    title: 'Hustota směsi',
    summary: 'Hustota dýchaného plynu v hloubce proti limitům 5,2 a 6,2 g/l.',
    tool: true,
    inputs: [pct('fO2', 'Kyslík', 8, 100, 21), pct('fHe', 'Helium', 0, 90, 0), depth(40, 100)],
    outputs: (v) => {
      const density = c.densityOfMix(v.fO2!, Math.min(v.fHe!, 1 - v.fO2!), v.depth!);
      return [{ label: 'Hustota v hloubce', value: density, unit: 'g/l', decimals: 2, tone: densityTone(density), bar: { max: 10, marks: DENSITY_MARKS }, note: 'Doporučený limit 5,2 g/l, tvrdý limit 6,2 g/l (Anthony & Mitchell, 2016).' }];
    },
    steps: (v) => c.densityOfMixSteps(v.fO2!, Math.min(v.fHe!, 1 - v.fO2!), v.depth!),
  },
  {
    id: 'optimal-trimix',
    title: 'Optimální trimix',
    summary: 'Nejvíc kyslíku a nejméně helia, které pro danou hloubku splní limity.',
    tool: true,
    inputs: [
      depth(60, 100),
      { key: 'limit', label: 'Limit ppO2', min: 1, max: 1.6, step: 0.1, unit: 'bar', initial: 1.3 },
      { key: 'end', label: 'Nejvyšší END', min: 20, max: 40, step: 1, unit: 'm', initial: 30 },
    ],
    outputs: (v) => {
      const depthM = Math.max(v.depth!, 1);
      const result = c.optimalTrimix({ depthM, ppO2MaxBar: v.limit!, endMaxM: v.end!, densityMaxGL: c.DENSITY_HARD_LIMIT_GL });
      const practical = c.practicalTrimix(result.gas);
      return [
        { label: 'Kyslík (zaokrouhleno dolů)', value: practical.fO2 * 100, unit: '%', decimals: 0 },
        { label: 'Helium (zaokrouhleno nahoru)', value: practical.fHe * 100, unit: '%', decimals: 0, bar: { max: 100 } },
        { label: 'Hustota této směsi v hloubce', value: c.gasDensity(practical, depthM), unit: 'g/l', decimals: 2, tone: densityTone(c.gasDensity(practical, depthM)), note: result.feasible ? `Helium určil limit ${result.limitedBy === 'density' ? 'hustoty 6,2 g/l' : result.limitedBy === 'end' ? 'END' : '– žádný, helium není potřeba'}.` : 'Limity nejdou splnit žádnou směsí.' },
      ];
    },
    steps: (v) => c.optimalTrimixSteps(Math.max(v.depth!, 1), v.limit!, v.end!),
  },
  {
    id: 'trimix-blend',
    title: 'Míchání trimixu',
    summary: 'Parciální tlaky pro prázdnou lahev: helium, kyslík, vzduch.',
    tool: true,
    inputs: [
      { key: 'target', label: 'Cílový tlak', min: 150, max: 300, step: 10, unit: 'bar', initial: 200 },
      pct('fO2', 'Kyslík', 10, 30, 18),
      pct('fHe', 'Helium', 10, 80, 45),
    ],
    outputs: (v) => {
      const blend = c.partialPressureBlend({ startBar: 0, targetBar: v.target!, targetGas: { fO2: v.fO2!, fHe: Math.min(v.fHe!, 1 - v.fO2!) } });
      if (!blend.feasible) return [{ label: 'Směs', value: null, unit: '', decimals: 0, tone: 'danger', note: 'Tuto směs nelze namíchat doplněním vzduchem – vzduch by přinesl víc kyslíku, než směs má mít. Doplňuje se pak směsí chudší na kyslík.' }];
      return [
        { label: 'Helium', value: blend.heBar, unit: 'bar', decimals: 1 },
        { label: 'Kyslík', value: blend.o2Bar, unit: 'bar', decimals: 1 },
        { label: 'Vzduch (doplnit do cílového tlaku)', value: blend.topBar, unit: 'bar', decimals: 1, note: 'Ideální plyn. Helium se od ideálního chování liší znatelně – výsledek vždy analyzuj na kyslík i helium.' },
      ];
    },
    steps: (v) => c.trimixBlendSteps(v.target!, v.fO2!, Math.min(v.fHe!, 1 - v.fO2!)),
  },
  // ── Modul 4: plný trimix ───────────────────────────────────────────────────
  {
    id: 'min-depth',
    title: 'Minimální hloubka hypoxické směsi',
    summary: 'Od jaké hloubky se dá směs s málo kyslíkem dýchat.',
    tool: true,
    inputs: [
      pct('fO2', 'Kyslík ve směsi', 5, 21, 10),
      { key: 'min', label: 'Nejnižší přípustné ppO2', min: 0.16, max: 0.21, step: 0.01, unit: 'bar', initial: 0.18 },
    ],
    outputs: (v) => {
      const surface = c.ppO2(v.fO2!, 0);
      return [
        { label: 'ppO2 na hladině', value: surface, unit: 'bar', decimals: 2, tone: surface < 0.16 ? 'danger' : surface < 0.18 ? 'warn' : 'ok' },
        { label: 'Dýchatelná od hloubky (zaokrouhleno nahoru)', value: c.ceilTo(c.minDepthForPpO2(v.fO2!, v.min!)), unit: 'm', decimals: 0, bar: { max: 30 }, note: 'Mělčeji se dýchá travel gas. Hypoxie nevaruje – bezvědomí přichází bez pocitu dušení.' },
      ];
    },
    steps: (v) => c.minDepthSteps(v.fO2!, v.min!),
  },
  {
    id: 'icd',
    title: 'Přepnutí He → N2 (pravidlo pětin)',
    summary: 'Kontrola izobarické protidifuze při přepnutí plynu.',
    tool: true,
    inputs: [
      pct('fromO2', 'Původní směs: kyslík', 8, 30, 12),
      pct('fromHe', 'Původní směs: helium', 0, 80, 65),
      pct('toO2', 'Nová směs: kyslík', 15, 100, 50),
      pct('toHe', 'Nová směs: helium', 0, 60, 0),
    ],
    outputs: (v) => {
      const from = { fO2: v.fromO2!, fHe: Math.min(v.fromHe!, 1 - v.fromO2!) };
      const to = { fO2: v.toO2!, fHe: Math.min(v.toHe!, 1 - v.toO2!) };
      const check = c.icdCheck(from, to);
      return [
        { label: 'Změna podílu helia', value: check.deltaHe * 100, unit: '%', decimals: 0 },
        { label: 'Změna podílu dusíku', value: check.deltaN2 * 100, unit: '%', decimals: 0, tone: check.ok ? 'ok' : 'danger' },
        { label: 'Nejvyšší přípustný nárůst dusíku', value: check.maxN2Increase * 100, unit: '%', decimals: 1, tone: check.ok ? 'ok' : 'danger', note: check.ok ? 'Přepnutí pravidlu pětin vyhovuje.' : 'Dusíku přibývá víc než pětina úbytku helia. Zvaž mezistupeň nebo dekompresní plyn s heliem. Pravidlo je provozní konvence, ne fyzikální zákon.' },
      ];
    },
  },
  {
    id: 'otu-days',
    title: 'Kyslík přes více dní',
    summary: 'Denní dávka OTU proti limitu REPEX pro sérii potápěčských dní.',
    tool: true,
    inputs: [
      { key: 'days', label: 'Počet dní po sobě', min: 1, max: 14, step: 1, unit: '', initial: 5 },
      { key: 'daily', label: 'OTU za den', min: 50, max: 900, step: 10, unit: 'OTU', initial: 350 },
    ],
    outputs: (v) => {
      const limit = c.repexDailyLimit(v.days!);
      return [
        { label: 'Průměrný denní limit pro tuto sérii', value: limit, unit: 'OTU', decimals: 0 },
        { label: 'Čerpání limitu', value: (v.daily! / limit) * 100, unit: '%', decimals: 0, tone: v.daily! > limit ? 'danger' : v.daily! > limit * 0.8 ? 'warn' : 'ok', bar: { max: 150, marks: [{ at: 100, label: '100' }] }, note: 'Limity REPEX (Hamilton, 1989). Část kyslíkové rezervy se nechává pro případnou léčbu v komoře.' },
      ];
    },
  },
  // ── Jeskynní moduly ────────────────────────────────────────────────────────
  {
    id: 'penetration',
    title: 'Dosah a návrat',
    summary: 'Jak daleko doplaveš na třetinu plynu a kolik stojí cesta ven pro dva.',
    tool: true,
    inputs: [
      { key: 'start', label: 'Tlak na začátku', min: 150, max: 300, step: 10, unit: 'bar', initial: 210 },
      { key: 'tank', label: 'Objem lahví', min: 10, max: 30, step: 1, unit: 'l', initial: 24 },
      { key: 'sac', label: 'Spotřeba (SAC)', min: 10, max: 30, step: 1, unit: 'l/min', initial: 20 },
      depth(20, 40),
      { key: 'speed', label: 'Rychlost plavání', min: 5, max: 25, step: 1, unit: 'm/min', initial: 15 },
    ],
    outputs: (v) => {
      const usable = c.ruleOfThirdsPractical(v.start!).usableBar;
      const distance = c.penetrationDistance(usable, v.tank!, v.sac!, v.depth!, v.speed!);
      return [
        { label: 'Třetina na cestu dovnitř', value: usable, unit: 'bar', decimals: 0 },
        { label: 'Dosah', value: c.floorTo(distance, 10), unit: 'm', decimals: 0, bar: { max: 800 } },
        { label: 'Návrat z tohoto místa', value: c.exitMinutes(distance, v.speed!), unit: 'min', decimals: 0 },
        { label: 'Plyn na cestu ven pro dva', value: c.ceilTo(c.exitGasBar(distance, v.speed!, v.sac!, v.depth!, v.tank!), 10), unit: 'bar', decimals: 0, note: 'Dvě třetiny, které po otočce zbývají, jsou právě plyn na cestu ven pro dva potápěče.' },
      ];
    },
  },
  {
    id: 'turn-speeds',
    title: 'Otočka s proudem a skútrem',
    summary: 'Jaký podíl plynu smíš použít dovnitř, když cesta ven potrvá jinak dlouho.',
    tool: true,
    inputs: [
      { key: 'start', label: 'Tlak na začátku', min: 150, max: 300, step: 10, unit: 'bar', initial: 210 },
      { key: 'speedIn', label: 'Rychlost dovnitř', min: 5, max: 60, step: 1, unit: 'm/min', initial: 20 },
      { key: 'speedOut', label: 'Rychlost ven (nejhorší případ)', min: 5, max: 60, step: 1, unit: 'm/min', initial: 10 },
    ],
    outputs: (v) => {
      const fraction = c.usableFraction(v.speedIn!, v.speedOut!);
      return [
        { label: 'Použitelný podíl plynu', value: fraction * 100, unit: '%', decimals: 0, bar: { max: 34 } },
        { label: 'Tlak otočky', value: c.ceilTo(c.turnPressureForSpeeds(v.start!, v.speedIn!, v.speedOut!), 10), unit: 'bar', decimals: 0, note: 'Podmínka: po otočce zbývá plyn na cestu ven pro dva. Víc než třetina se nepoužije nikdy, ani když je cesta ven rychlejší.' },
      ];
    },
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
    case 'l/min': return 0.5;
    case 'l': return Math.max(5, Math.abs(step.value) * 0.02);
    case 'g/l': return 0.05;
    case '%': case 'OTU': case 'min': return 1;
    default: return Math.max(0.1, Math.abs(step.value) * 0.01);
  }
}
