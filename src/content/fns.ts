/**
 * Jediný seznam funkcí, které smí obsah volat (lekce, otázky, případovky, vzorce):
 * čisté výpočty z @diveedu/calc a výukový dekompresní model z @diveedu/deco.
 */
import * as calc from '@diveedu/calc';
import * as deco from '@diveedu/deco';

export const FUNCTIONS: Readonly<Record<string, unknown>> = { ...calc, ...deco };

export const isContentFunction = (name: string): boolean => typeof FUNCTIONS[name] === 'function';

export function callContentFunction(name: string, args: readonly unknown[]): unknown {
  const fn = FUNCTIONS[name];
  if (typeof fn !== 'function') throw new Error(`Neznámá funkce: ${name}`);
  return (fn as (...a: unknown[]) => unknown)(...args);
}
