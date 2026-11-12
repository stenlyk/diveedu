import { describe, expect, it } from 'vitest';
import type { NumericTemplate } from '../content/schema';
import { checkNumeric, generateVariant, renderPrompt } from './numeric';

const template: NumericTemplate = {
  fn: 'absPressure',
  params: { depth: { min: 10, max: 40, step: 10 } },
  args: ['depth'],
  tolerance: 0.05,
  unit: 'bar',
  decimals: 1,
};

describe('numerické otázky', () => {
  it('generuje hodnoty v rozsahu a na kroku, výsledek počítá calc', () => {
    for (const r of [0, 0.3, 0.6, 0.999]) {
      const variant = generateVariant(template, () => r);
      expect([10, 20, 30, 40]).toContain(variant.values.depth);
      expect(variant.answer).toBe(variant.values.depth! / 10 + 1);
    }
    expect(generateVariant(template, () => 0).values.depth).toBe(10);
    expect(generateVariant(template, () => 0.999).values.depth).toBe(40);
  });
  it('vybírá ze seznamu hodnot', () => {
    const listed: NumericTemplate = { ...template, fn: 'depthFromPressure', params: { p: { values: [2, 4] } }, args: ['p'] };
    expect(generateVariant(listed, () => 0).answer).toBe(10);
    expect(generateVariant(listed, () => 0.99).answer).toBe(30);
  });
  it('odmítne neznámou funkci', () => {
    expect(() => generateVariant({ ...template, fn: 'neexistuje' })).toThrow(/Neznámá funkce/);
  });
  it('dosazuje do promptu s desetinnou čárkou', () => {
    expect(renderPrompt('Tlak v {depth} m při {pp} bar a {x}?', { depth: 30, pp: 1.4 })).toBe('Tlak v 30 m při 1,4 bar a {x}?');
  });
  it('vyhodnocuje s tolerancí, čárkou i tečkou', () => {
    expect(checkNumeric('4', 4, 0.05)).toBe('correct');
    expect(checkNumeric('4,05', 4, 0.05)).toBe('correct');
    expect(checkNumeric('4.1', 4, 0.05)).toBe('wrong');
    expect(checkNumeric('čtyři', 4, 0.05)).toBe('invalid');
    expect(checkNumeric('', 4, 0.05)).toBe('invalid');
  });
});
