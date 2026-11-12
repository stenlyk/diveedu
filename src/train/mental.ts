/**
 * Úlohy pro režim „Z hlavy na čas“. Zadání se losuje, výsledek vždy počítá @diveedu/calc.
 * Tolerance podle SPEC: ±1 m, ±0,02 bar.
 */
import * as c from '@diveedu/calc';

export interface MentalTask {
  taskId: string;
  prompt: string;
  answer: number;
  unit: string;
  tolerance: number;
  decimals: number;
  tip: string;
}

interface TaskDef {
  id: string;
  level: 1 | 2 | 3;
  label: string;
  tip: string;
  make: (pick: Pick) => Omit<MentalTask, 'taskId' | 'tip'>;
}

type Pick = <T>(items: readonly T[]) => T;
const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const TRIMIXES = [[21, 35], [18, 45], [15, 55], [12, 65], [10, 70]] as const;
const bar = (answer: number, prompt: string) => ({ prompt, answer, unit: 'bar', tolerance: 0.02, decimals: 2 });
const meters = (answer: number, prompt: string) => ({ prompt, answer, unit: 'm', tolerance: 1, decimals: 1 });

export const MENTAL_TASKS: TaskDef[] = [
  {
    id: 'pabs', level: 1, label: 'Absolutní tlak',
    tip: 'Hloubku vyděl deseti a přičti jedna.',
    make: (pick) => { const d = pick(range(10, 60, 10)); return bar(c.absPressure(d), `Absolutní tlak ve ${d} m?`); },
  },
  {
    id: 'ppo2-std', level: 1, label: 'ppO2, kulaté hodnoty',
    tip: 'Frakce kyslíku krát absolutní tlak. EAN32 ve 30 m: 0,32 × 4.',
    make: (pick) => { const o2 = pick([21, 32, 36, 50]); const d = pick(range(10, 40, 10)); return bar(c.ppO2(o2 / 100, d), `ppO2 směsi s ${o2} % O2 ve ${d} m?`); },
  },
  {
    id: 'mod-std', level: 1, label: 'MOD standardních směsí',
    tip: 'Limit vyděl frakcí, odečti 1, vynásob 10. Pro 1,4 bar: 140 / procenta kyslíku. EAN32: 140 / 32 ≈ 4,4 → 34 m.',
    make: (pick) => { const o2 = pick([32, 36, 50, 100]); const limit = pick([1.4, 1.6]); return meters(c.mod(o2 / 100, limit), `MOD směsi s ${o2} % O2 při ${c.formatCs(limit, 1)} bar?`); },
  },
  {
    id: 'ppo2-any', level: 2, label: 'ppO2, libovolné hodnoty',
    tip: 'Nejdřív tlak, pak násob. 27 % ve 33 m: 4,3 × 0,27 ≈ 4 × 0,27 + 0,3 × 0,27.',
    make: (pick) => { const o2 = pick(range(21, 40)); const d = pick(range(12, 45, 3)); return bar(c.ppO2(o2 / 100, d), `ppO2 směsi s ${o2} % O2 ve ${d} m?`); },
  },
  {
    id: 'mod-any', level: 2, label: 'MOD libovolné směsi',
    tip: '140 (nebo 160) děleno procenty kyslíku dá tlak. Odečti 1 a vynásob 10.',
    make: (pick) => { const o2 = pick(range(25, 45)); const limit = pick([1.4, 1.6]); return meters(c.mod(o2 / 100, limit), `MOD směsi s ${o2} % O2 při ${c.formatCs(limit, 1)} bar?`); },
  },
  {
    id: 'best-mix', level: 2, label: 'Best mix',
    tip: 'Limit děleno tlakem. Ve 30 m při 1,4 bar: 1,4 / 4 = 35 %.',
    make: (pick) => { const d = pick(range(18, 45, 3)); const limit = pick([1.4, 1.6]); return { prompt: `Nejvyšší procento O2 pro ${d} m při ${c.formatCs(limit, 1)} bar?`, answer: c.bestMix(d, limit) * 100, unit: '%', tolerance: 1, decimals: 1 }; },
  },
  {
    id: 'ead', level: 2, label: 'EAD',
    tip: 'Podíl dusíku děleno 0,79, krát (hloubka + 10), minus 10. Pro EAN32 je poměr asi 0,86, pro EAN36 asi 0,81.',
    make: (pick) => { const o2 = pick([28, 30, 32, 36, 40]); const d = pick(range(18, 36, 3)); return meters(c.ead(o2 / 100, d), `EAD směsi EAN${o2} ve ${d} m?`); },
  },
  {
    id: 'end', level: 3, label: 'END trimixu',
    tip: 'Kyslík se počítá jako narkotický: (1 − podíl helia) × (hloubka + 10) − 10.',
    make: (pick) => { const [o2, he] = pick(TRIMIXES); const d = pick(range(45, 90, 5)); return meters(c.end(c.trimix(o2, he), d), `END směsi Tx ${o2}/${he} v ${d} m (O2 narkotický)?`); },
  },
  {
    id: 'density-air', level: 3, label: 'Hustota vzduchu',
    tip: 'Vzduch má na hladině asi 1,3 g/l. Vynásob absolutním tlakem.',
    make: (pick) => { const d = pick(range(10, 60, 5)); return { prompt: `Hustota vzduchu ve ${d} m?`, answer: c.airDensity(d), unit: 'g/l', tolerance: 0.15, decimals: 2 }; },
  },
  {
    id: 'density-tx', level: 3, label: 'Hustota trimixu',
    tip: 'Na hladině: 1,43 × O2 + 1,25 × N2 + 0,18 × He. Každých 10 % helia místo dusíku ubere asi 0,11 g/l. Pak krát tlak.',
    make: (pick) => { const [o2, he] = pick(TRIMIXES); const d = pick(range(45, 90, 5)); return { prompt: `Hustota směsi Tx ${o2}/${he} v ${d} m?`, answer: c.gasDensity(c.trimix(o2, he), d), unit: 'g/l', tolerance: 0.15, decimals: 2 }; },
  },
  {
    id: 'he-for-end', level: 3, label: 'Helium pro END 30 m',
    tip: 'Narkotická část smí být nejvýš (30 + 10) / (hloubka + 10). Zbytek do 100 % je helium.',
    make: (pick) => { const d = pick(range(45, 90, 5)); return { prompt: `Kolik % helia je potřeba v ${d} m, aby END bylo nejvýš 30 m?`, answer: c.minHeForEnd(d, 30) * 100, unit: '%', tolerance: 1, decimals: 1 }; },
  },
];

export const MAX_LEVEL = 3;

export function generateTask(level: number, rng: () => number = Math.random, previousId?: string): MentalTask {
  const pick: Pick = (items) => items[Math.floor(rng() * items.length)]!;
  const pool = MENTAL_TASKS.filter((task) => task.level <= level && task.level >= level - 1);
  const candidates = pool.length > 1 ? pool.filter((task) => task.id !== previousId) : pool;
  const def = pick(candidates);
  return { taskId: def.id, tip: def.tip, ...def.make(pick) };
}

export function checkMental(input: string, task: MentalTask): boolean | null {
  const value = c.parseCs(input);
  if (value === null) return null;
  return Math.abs(value - task.answer) <= task.tolerance + 1e-9;
}

/** Obtížnost roste po třech správných v řadě a klesá po dvou chybách v řadě. */
export function nextLevel(level: number, history: readonly boolean[]): number {
  const last = history.slice(-3);
  if (last.length === 3 && last.every(Boolean)) return Math.min(MAX_LEVEL, level + 1);
  if (history.slice(-2).length === 2 && history.slice(-2).every((ok) => !ok)) return Math.max(1, level - 1);
  return level;
}
