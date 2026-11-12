import { describe, expect, it } from 'vitest';
import { edgeBetween, feel, hasLine, isDecisionPoint, metersToStart, move, navDebrief, neighbors, nodeOf, placeCookie, startNav, TRAINING_CAVE as MAP, turn, turnBar } from './nav';

const go = (path: string[], state = startNav(MAP), spool = false) => path.reduce((s, to) => move(MAP, s, to, spool), state);

describe('mapa', () => {
  it('zná sousedy, úseky a vzdálenost k vchodu', () => {
    expect(neighbors(MAP, 't').map((n) => n.to).sort()).toEqual(['a', 'b', 'c']);
    expect(edgeBetween(MAP, 'b', 't')?.meters).toBe(90);
    expect(edgeBetween(MAP, 'v1', 'd')).toBeUndefined();
    expect(metersToStart(MAP, 's')).toBe(310);
    expect(metersToStart(MAP, 'v1')).toBe(0);
    expect(() => nodeOf(MAP, 'x')).toThrow();
    expect(turnBar(MAP)).toBe(140);
  });
  it('vzdálenost bez cesty je nekonečno', () => {
    expect(metersToStart({ ...MAP, edges: [] }, 'd')).toBe(Infinity);
  });
  it('rozcestí T je místo rozhodnutí, dóm B až po položení skoku', () => {
    const start = startNav(MAP);
    expect(isDecisionPoint(MAP, start, 't')).toBe(true);
    expect(isDecisionPoint(MAP, start, 'b')).toBe(false);
    expect(isDecisionPoint(MAP, { jumps: ['b|j'] }, 'b')).toBe(true);
    expect(hasLine(MAP, start, 'b', 'j')).toBe(false);
    expect(hasLine(MAP, start, 'v1', 'd')).toBe(false);
  });
});

describe('cesta dovnitř', () => {
  it('plavání stojí plyn a čas', () => {
    const state = go(['a']);
    expect(state.at).toBe('a');
    expect(state.from).toBe('v1');
    expect(state.minutes).toBeCloseTo(80 / 15, 5);
    expect(state.gasBar).toBeCloseTo(210 - (80 / 15) * (20 * 3.4) / 24, 5);
    expect(state.metersIn).toBe(80);
  });
  it('neznámý úsek stav nemění', () => {
    const state = startNav(MAP);
    expect(move(MAP, state, 'd')).toBe(state);
  });
  it('značka označí cestu ven a ubere zásobu; dvakrát ani bez směru to nejde', () => {
    const start = startNav(MAP);
    expect(placeCookie(MAP, start)).toBe(start);
    const atT = placeCookie(MAP, go(['a', 't']));
    expect(atT.cookies).toEqual(['t>a']);
    expect(atT.cookiesLeft).toBe(2);
    expect(placeCookie(MAP, atT)).toBe(atT);
    expect(placeCookie(MAP, { ...go(['a', 't']), cookiesLeft: 0 }).cookies).toEqual([]);
  });
  it('odchod z rozcestí bez značky se zaznamená jednou', () => {
    const state = go(['a', 't', 'b']);
    expect(state.unmarked).toEqual(['t']);
    expect(placeCookie(MAP, go(['a', 't'])).unmarked).toEqual([]);
    expect(go(['b'], placeCookie(MAP, go(['a', 't']))).unmarked).toEqual([]);
    expect(go(['a', 't', 'a', 't', 'b']).unmarked).toEqual(['t']);
  });
  it('skok cívkou udrží souvislou šňůru, bez cívky je to porušení', () => {
    const jumped = go(['j'], go(['a', 't', 'b']), true);
    expect(jumped.jumps).toEqual(['b|j']);
    expect(jumped.spoolsLeft).toBe(1);
    expect(jumped.violations).toEqual([]);
    expect(jumped.unmarked).toEqual(['t', 'b']);
    const swum = go(['a', 't', 'b', 'j']);
    expect(swum.violations.map((v) => v.kind)).toEqual(['gap']);
    const noSpools = move(MAP, { ...go(['a', 't', 'b']), spoolsLeft: 0 }, 'j', true);
    expect(noSpools.violations.map((v) => v.kind)).toEqual(['gap']);
  });
  it('skok s označenou cestou ven nezanechá neoznačené rozcestí', () => {
    const atB = placeCookie(MAP, go(['b'], placeCookie(MAP, go(['a', 't']))));
    expect(move(MAP, atB, 'j', true).unmarked).toEqual([]);
  });
  it('pokračování za tlak otočky je porušení, zaznamenané jednou', () => {
    const state = go(['a', 't', 'b', 'd', 'b']);
    expect(state.gasBar).toBeLessThan(140);
    expect(state.violations.filter((v) => v.kind === 'turn-late')).toHaveLength(1);
  });
  it('plyn může dojít', () => {
    const state = go(['a', 't', 'b', 'd', 'b', 'd', 'b', 'd', 'b', 'd', 'b', 'd', 'b', 'd', 'b']);
    expect(state.outcome?.result).toBe('fail');
    expect(state.gasBar).toBe(0);
    expect(move(MAP, state, 't')).toBe(state);
  });
});

describe('otočka a návrat', () => {
  it('otočka přepne fázi; pod tlakem otočky to řekne; podruhé nic', () => {
    const turned = turn(MAP, go(['a', 't']));
    expect(turned.phase).toBe('out');
    expect(turned.from).toBeNull();
    expect(turn(MAP, turned)).toBe(turned);
    expect(turn(MAP, go(['a', 't', 'b', 'd'])).log.at(-1)?.tone).toBe('bad');
    expect(turn(MAP, go(['a'], startNav(MAP, false))).log.at(-1)?.text).toContain('Vracíš se');
  });
  it('po hmatu ukáže značky: vlastní značku, šipky a cestu zpět', () => {
    const state = move(MAP, turn(MAP, go(['b'], placeCookie(MAP, go(['a', 't'])))), 't');
    const felt = feel(MAP, state);
    expect(felt.find((line) => line.to === 'a')).toMatchObject({ cookie: true, arrow: 'away', back: false, blind: false });
    expect(felt.find((line) => line.to === 'c')).toMatchObject({ cookie: false, arrow: 'away' });
    expect(felt.find((line) => line.to === 'b')).toMatchObject({ arrow: 'toward', back: true });
  });
  it('mezera bez šňůry se nahmatat nedá, položený skok ano', () => {
    const atB = go(['a', 't', 'b']);
    expect(feel(MAP, atB).find((line) => line.to === 'j')).toMatchObject({ blind: true, jump: false, arrow: null });
    expect(feel(MAP, move(MAP, turn(MAP, move(MAP, atB, 'j', true)), 'b')).find((line) => line.to === 'j')).toMatchObject({ blind: false, jump: true });
  });
  it('čistý průchod končí úspěchem a značky se cestou ven sbírají', () => {
    let state = placeCookie(MAP, go(['a', 't']));
    state = placeCookie(MAP, move(MAP, state, 'b'));
    state = go(['s'], move(MAP, state, 'j', true));
    state = go(['j', 'b', 't', 'a', 'v1'], turn(MAP, state));
    expect(state.outcome?.result).toBe('success');
    expect(state.cookiesLeft).toBe(3);
    expect(state.gasBar).toBeGreaterThan(0);
    const summary = navDebrief(MAP, state);
    expect(summary.issues).toEqual([]);
    expect(summary.notes).toHaveLength(1);
    expect(summary.notes[0]).toContain('rezervní třetiny');
  });
  it('návrat v nulové viditelnosti je pomalejší', () => {
    const blind = move(MAP, turn(MAP, go(['a'])), 'v1');
    const clear = move(MAP, turn(MAP, go(['a'], startNav(MAP, false))), 'v1');
    expect(blind.minutes).toBeGreaterThan(clear.minutes);
    expect(clear.log.some((event) => event.text.startsWith('Vchod 1 ·'))).toBe(true);
  });
  it('špatná odbočka se pozná a vede k cizímu vchodu', () => {
    const state = go(['c', 'v2'], turn(MAP, go(['a', 't', 'b', 't'])));
    expect(state.violations.map((v) => v.kind)).toContain('wrong-turn');
    expect(state.outcome?.result).toBe('partial');
    expect(state.outcome?.text).toContain('jiným vchodem');
  });
  it('mezera přeplavaná bez šňůry se v nulové viditelnosti nedá najít zpět', () => {
    const state = move(MAP, turn(MAP, go(['a', 't', 'b', 'j', 's', 'j'])), 'b');
    expect(state.outcome?.result).toBe('fail');
    const clear = move(MAP, turn(MAP, go(['a', 't', 'b', 'j'], startNav(MAP, false))), 'b');
    expect(clear.outcome).toBeUndefined();
  });
  it('návrat s porušením je jen částečný úspěch a rozbor ho pojmenuje', () => {
    const state = go(['b', 't', 'a', 'v1'], turn(MAP, go(['a', 't', 'b', 'd'])));
    expect(state.outcome?.result).toBe('partial');
    const summary = navDebrief(MAP, state);
    expect(summary.issues[0]).toContain('tlak otočky');
    expect(summary.notes[0]).toBe('Bod „Rozcestí T“ jsi cestou dovnitř neoznačil vlastní značkou.');
  });
  it('rozbor upozorní na spotřebovanou rezervu', () => {
    const state = go(['t', 'a', 'v1'], turn(MAP, go(['a', 't', 'b', 'd', 'b'], startNav(MAP, false))));
    expect(state.outcome?.result).toBe('partial');
    expect(navDebrief(MAP, state).issues.some((issue) => issue.includes('rezervní třetina'))).toBe(true);
  });
  it('plyn může dojít i cestou ven', () => {
    const state = go(['b', 't', 'a', 'v1'], turn(MAP, go(['a', 't', 'b', 'd', 'b', 'd', 'b', 'd'])));
    expect(state.outcome).toEqual({ result: 'fail', text: 'Došel plyn.' });
  });
});
