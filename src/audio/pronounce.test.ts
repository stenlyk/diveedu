import { describe, expect, it } from 'vitest';
import content from '../content/generated/content.json';
import { lessonSpeech, toSpeech, unknownAbbreviations } from './pronounce';

describe('toSpeech', () => {
  it('čte zkratky po písmenech nebo zavedeným slovem', () => {
    expect(toSpeech('MOD a END')).toBe('em ó dé a é en dé');
    expect(toSpeech('Kyslíková toxicita CNS')).toBe('Kyslíková toxicita cé en es');
    expect(toSpeech('ppO2 je 1,4 bar')).toBe('pé pé ó dva je 1,4 bar');
    expect(toSpeech('CO2 v hloubce')).toBe('cé ó dva v hloubce');
    expect(toSpeech('SAC: tvoje spotřeba')).toBe('sak: tvoje spotřeba');
  });
  it('čte směsi a gradient factors', () => {
    expect(toSpeech('EAN50 od 21 m')).toBe('nitrox 50 od 21 m');
    expect(toSpeech('Tx 18/45 a Tx21/35')).toBe('trimix 18 45 a trimix 21 35');
    expect(toSpeech('GF 30/85')).toBe('gé ef 30 85');
    expect(toSpeech('model ZHL-16C')).toBe('model zet há el šestnáct cé');
  });
  it('rozepisuje složené jednotky', () => {
    expect(toSpeech('15 m/min, 20 l/min, 5,2 g/l')).toBe('15 metrů za minutu, 20 litrů za minutu, 5,2 gramů na litr');
  });
  it('odstraní uvozovky a nahradí pomlčky a znaky', () => {
    expect(toSpeech('„jen kousek“ – a dost')).toBe('jen kousek, a dost');
    expect(toSpeech('2 × víc, ≥ 3, ≤ 5')).toBe('2 krát víc, nejméně 3, nejvýše 5');
  });
  it('běžná slova nechává být, i když obsahují stejná písmena', () => {
    expect(toSpeech('Model, modrá, helium, Heliox')).toBe('Model, modrá, helium, Heliox');
  });
});

describe('unknownAbbreviations', () => {
  it('najde zkratku, kterou slovník nezná', () => {
    expect(unknownAbbreviations('Podle XYZ a Q7 je to jinak, MOD známe.')).toEqual(['XYZ', 'Q7']);
    expect(unknownAbbreviations('Samá běžná slova. A věta.')).toEqual([]);
  });
});

describe('obsah', () => {
  it('každé shrnutí i název lekce jde přečíst bez neznámých zkratek', () => {
    const problems = content.lessons.flatMap((lesson) => unknownAbbreviations(`${lesson.title}. ${lesson.audioSummary}`).map((word) => `${lesson.id}: ${word}`));
    expect(problems).toEqual([]);
  });
  it('lessonSpeech spojí název a shrnutí', () => {
    expect(lessonSpeech({ title: 'CNS hodiny', audioSummary: 'Limit je daný ppO2.' })).toBe('cé en es hodiny. Limit je daný pé pé ó dva.');
  });
});
