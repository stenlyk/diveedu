import { describe, expect, it } from 'vitest';
import { checkMental, generateTask, MENTAL_TASKS, nextLevel } from './mental';

describe('úlohy z hlavy', () => {
  it('každá úloha dává konečný výsledek v celém rozsahu zadání', () => {
    for (const def of MENTAL_TASKS) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        const task = def.make((items) => items[Math.floor(r * items.length)]!);
        expect(Number.isFinite(task.answer), `${def.id} @ ${r}`).toBe(true);
        expect(task.answer).toBeGreaterThanOrEqual(0);
        expect(task.prompt).not.toMatch(/undefined|NaN/);
      }
    }
  });
  it('úroveň 1 dává jen úlohy úrovně 1; vyšší úroveň míchá s předchozí', () => {
    const ids = (level: number) => new Set(Array.from({ length: 200 }, (_, i) => generateTask(level, () => (i * 0.137) % 1).taskId));
    const levelOf = (id: string) => MENTAL_TASKS.find((t) => t.id === id)!.level;
    expect([...ids(1)].every((id) => levelOf(id) === 1)).toBe(true);
    expect([...ids(3)].every((id) => levelOf(id) >= 2)).toBe(true);
    expect([...ids(3)].some((id) => levelOf(id) === 3)).toBe(true);
  });
  it('neopakuje stejný typ úlohy dvakrát po sobě', () => {
    for (let i = 0; i < 50; i++) expect(generateTask(1, () => 0, 'pabs').taskId).not.toBe('pabs');
  });
  it('známé hodnoty: tlak ve 30 m, MOD EAN32', () => {
    const pabs = MENTAL_TASKS.find((t) => t.id === 'pabs')!.make((items) => items[2]!);
    expect(pabs.answer).toBe(4);
    const mod = MENTAL_TASKS.find((t) => t.id === 'mod-std')!.make((items) => items[0]!);
    expect(mod.answer).toBeCloseTo(33.75, 10);
  });
  it('vyhodnocení s tolerancí ±1 m a ±0,02 bar', () => {
    const task = { taskId: 'x', prompt: '', answer: 33.75, unit: 'm', tolerance: 1, decimals: 1, tip: '' };
    expect(checkMental('33', task)).toBe(true);
    expect(checkMental('34,5', task)).toBe(true);
    expect(checkMental('35', task)).toBe(false);
    expect(checkMental('', task)).toBeNull();
    expect(checkMental('1,29', { ...task, answer: 1.28, tolerance: 0.02 })).toBe(true);
    expect(checkMental('1,31', { ...task, answer: 1.28, tolerance: 0.02 })).toBe(false);
  });
  it('obtížnost: nahoru po třech správných, dolů po dvou chybách', () => {
    expect(nextLevel(1, [true, true, true])).toBe(2);
    expect(nextLevel(1, [false, true, true])).toBe(1);
    expect(nextLevel(3, [true, true, true])).toBe(3);
    expect(nextLevel(2, [true, false, false])).toBe(1);
    expect(nextLevel(1, [false, false])).toBe(1);
    expect(nextLevel(2, [true])).toBe(2);
  });
});
