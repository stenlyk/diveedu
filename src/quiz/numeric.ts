/** Numerické otázky: generování variant ze šablony a vyhodnocení odpovědi. Výsledek vždy počítá calc. */
import * as calc from '@diveedu/calc';
import type { NumericTemplate } from '../content/schema';

const fns = calc as unknown as Record<string, (...args: number[]) => number>;

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
  const values = Object.fromEntries(Object.entries(template.params).map(([name, param]) => [name, pick(param, rng)]));
  const fn = fns[template.fn];
  if (typeof fn !== 'function') throw new Error(`Neznámá funkce calc: ${template.fn}`);
  return { values, answer: fn(...template.args.map((arg) => values[arg]!)) };
}

/** Dosadí hodnoty do promptu; čísla formátuje česky. */
export function renderPrompt(prompt: string, values: Record<string, number>): string {
  return prompt.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    if (value === undefined) return match;
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
