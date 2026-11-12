import { describe, expect, it } from 'vitest';
import { ScenarioSchema } from '../content/schema';
import { debrief, decide, nodeOf, OUT_OF_GAS_TEXT, startScenario } from './engine';

const scenario = ScenarioSchema.parse({
  id: 'test',
  title: 'Test',
  summary: 'x',
  moduleIds: ['m'],
  conceptIds: ['c'],
  intro: 'x',
  setup: { startBar: 100, tankLiters: 24, depthM: 20, sacLpm: 20 },
  start: 'a',
  nodes: [
    {
      id: 'a', text: 'Co teď?', timeLimitSec: 10,
      timeout: { next: 'a', minutes: 1, feedback: 'Váhal jsi.' },
      options: [
        { text: 'Zastav', next: 'b', minutes: 2, verdict: 'good', feedback: 'Správně.' },
        { text: 'Plav rychle', next: 'fail', minutes: 4, stress: 3, verdict: 'bad', feedback: 'Zbytečně.' },
        { text: 'Čekej', next: 'b', minutes: 30, stress: 2, verdict: 'ok', feedback: 'Dlouho.' },
      ],
    },
    { id: 'b', text: 'A dál?', options: [{ text: 'Ven', next: 'win', minutes: 5, verdict: 'good', feedback: 'Ano.' }, { text: 'Dál', next: 'fail', minutes: 5, verdict: 'bad', feedback: 'Ne.' }] },
    { id: 'win', text: 'x', end: { outcome: 'success', text: 'Venku.' } },
    { id: 'fail', text: 'x', end: { outcome: 'fail', text: 'Špatně.' } },
  ],
  sources: [{ title: 'x' }],
});

describe('průchod scénářem', () => {
  it('správná cesta končí úspěchem a plyn ubývá podle calc', () => {
    let state = startScenario(scenario);
    expect(state).toMatchObject({ nodeId: 'a', gasBar: 100, elapsedMin: 0 });
    state = decide(scenario, state, 0);
    // 20 l/min · 3 bar / 24 l = 2,5 bar/min; 2 minuty = 5 bar
    expect(state.gasBar).toBeCloseTo(95, 8);
    expect(state.finished).toBeUndefined();
    state = decide(scenario, state, 0);
    expect(state.gasBar).toBeCloseTo(82.5, 8);
    expect(state.elapsedMin).toBe(7);
    expect(state.finished).toEqual({ outcome: 'success', text: 'Venku.' });
    expect(debrief(state)).toEqual({ good: 2, ok: 0, bad: 0, clean: true });
  });
  it('stres násobí spotřebu a špatná volba vede k neúspěchu', () => {
    const state = decide(scenario, startScenario(scenario), 1);
    expect(state.gasBar).toBeCloseTo(70, 8); // 4 min · 2,5 · 3
    expect(state.finished?.outcome).toBe('fail');
    expect(debrief(state)).toMatchObject({ bad: 1, clean: false });
  });
  it('vypršení času je špatné rozhodnutí se stresovou spotřebou', () => {
    const state = decide(scenario, startScenario(scenario), 'timeout');
    expect(state.nodeId).toBe('a');
    expect(state.gasBar).toBeCloseTo(95, 8); // 1 min · 2,5 · 2
    expect(state.decisions[0]).toMatchObject({ choice: null, verdict: 'bad', feedback: 'Váhal jsi.' });
    const done = decide(scenario, decide(scenario, state, 0), 0);
    expect(debrief(done)).toMatchObject({ good: 2, bad: 1, clean: false });
    expect(done.finished?.outcome).toBe('success');
  });
  it('dojde-li plyn, scénář končí neúspěchem', () => {
    const state = decide(scenario, startScenario(scenario), 2); // 30 min · 2,5 · 2 = 150 bar
    expect(state.gasBar).toBe(0);
    expect(state.finished).toEqual({ outcome: 'fail', text: OUT_OF_GAS_TEXT });
  });
  it('po skončení se stav nemění a neplatné volby vyhodí chybu', () => {
    const done = decide(scenario, startScenario(scenario), 1);
    expect(decide(scenario, done, 0)).toBe(done);
    expect(() => decide(scenario, startScenario(scenario), 9)).toThrow(/neplatná volba/);
    const atB = decide(scenario, startScenario(scenario), 0);
    expect(() => decide(scenario, atB, 'timeout')).toThrow(/neplatná volba/);
    expect(() => nodeOf(scenario, 'nic')).toThrow(/neznámý uzel/);
  });
});
