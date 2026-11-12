/** Numerické otázky: generování variant ze šablony a vyhodnocení odpovědi. Výsledek vždy počítá calc. */
import * as calc from '@diveedu/calc';
import { callContentFunction } from '../content/fns';
import type { NumericTemplate } from '../content/schema';


export interface NumericVariant {
  values: Record<string, number>;
  answer: number;
}

export type Rng = () => number;

function pick(param: NumericTemplate['params'][string], rng: Rng): number {
  if ('values' in param) return param.values[Math.floor(rng() * param.values.length)]!;
  const steps = Math.floor((param.max - param.min) / param.step + 1e-9);
  const value = param.min + Math.floor(rng() * (steps + 1)) * param.step;
  return Number(value.toFixed(6));
}

export function generateVariant(template: NumericTemplate, rng: Rng = Math.random): NumericVariant {
  const values = { ...template.fixed, ...Object.fromEntries(Object.entries(template.params).map(([name, param]) => [name, pick(param, rng)])) };
  return { values, answer: callContentFunction(template.fn, template.args.map((arg) => values[arg]!)) as number };
}

/** Dosadí hodnoty do promptu; čísla formátuje česky. */
export function renderPrompt(prompt: string, values: Record<string, number>): string {
  return prompt.replace(/\{(\w+)(\|percent)?\}/g, (match, name: string, percent?: string) => {
    const raw = values[name];
    if (raw === undefined) return match;
    // {fO2|percent}: frakce 0,32 se v zadání ukáže jako 32
    const value = percent ? Number((raw * 100).toFixed(4)) : raw;
    const decimals = Number.isInteger(value) ? 0 : Math.min(3, (String(value).split('.')[1] ?? '').length);
    return calc.formatCs(value, decimals);
  });
}

export type NumericVerdict = 'correct' | 'wrong' | 'invalid';

export function checkNumeric(input: string, answer: number, tolerance: number): NumericVerdict {
  const value = calc.parseCs(input);
  if (value === null) return 'invalid';
  return Math.abs(value - answer) <= tolerance + 1e-9 ? 'correct' : 'wrong';
}
