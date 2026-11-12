import { describe, expect, it } from 'vitest';
import type { Question } from '../content/schema';
import { buildReviewQueue, completedModules, conceptMastery, dailyStats, masteryLevel, pickExamQuestions, streakDays, weakestConcepts } from './mastery';
import { autoGrade, schedule } from './scheduler';

const DAY = 86_400_000;
const NOW = new Date('2026-11-12T12:00:00').getTime();
const q = (id: string, conceptIds: string[], difficulty = 1, lesson = 'l1'): Question =>
  ({ id, type: 'choice', conceptIds, difficulty, prompt: 'x', explanation: 'x', options: [], sources: [], needs_review: false, backToLessonId: lesson }) as Question;
const answer = (questionId: string, correct: boolean, daysAgo = 0, durationMs = 5000) => ({ questionId, at: NOW - daysAgo * DAY, correct, durationMs, mode: 'quick' });

describe('plánování karet (FSRS)', () => {
  const now = new Date(NOW);
  it('nová karta: špatná odpověď se vrátí za minuty, snadná za dny', () => {
    const again = schedule(undefined, 'again', now);
    const easy = schedule(undefined, 'easy', now);
    expect(again.due - NOW).toBeLessThan(15 * 60_000);
    expect(easy.due - NOW).toBeGreaterThan(DAY);
  });
  it('opakované úspěchy interval prodlužují', () => {
    let state = schedule(undefined, 'good', now);
    const intervals: number[] = [];
    let time = NOW;
    for (let i = 0; i < 4; i++) {
      time = state.due;
      const next = schedule(state.state, 'good', new Date(time));
      intervals.push(next.due - time);
      state = next;
    }
    expect(intervals[3]!).toBeGreaterThan(intervals[1]!);
    expect(intervals[3]!).toBeGreaterThan(3 * DAY);
  });
  it('stav přežije uložení do JSON', () => {
    const first = schedule(undefined, 'good', now);
    const stored = JSON.parse(JSON.stringify(first.state));
    expect(schedule(stored, 'good', new Date(first.due)).due).toBeGreaterThan(first.due);
  });
  it('chyba po naučení interval zkrátí', () => {
    let state = schedule(undefined, 'easy', now);
    state = schedule(state.state, 'easy', new Date(state.due));
    const lapse = schedule(state.state, 'again', new Date(state.due));
    expect(lapse.due - state.due).toBeLessThan(DAY);
  });
  it('automatické hodnocení podle výsledku a času', () => {
    expect(autoGrade(false, 1000, 'choice')).toBe('again');
    expect(autoGrade(true, 5000, 'choice')).toBe('easy');
    expect(autoGrade(true, 15_000, 'choice')).toBe('good');
    expect(autoGrade(true, 40_000, 'choice')).toBe('hard');
    expect(autoGrade(true, 15_000, 'numeric')).toBe('easy');
    expect(autoGrade(true, 40_000, 'numeric')).toBe('good');
    expect(autoGrade(true, 120_000, 'order')).toBe('hard');
  });
});

describe('zvládnutí uzlů', () => {
  const questions = new Map([q('a', ['tlak']), q('b', ['tlak', 'objem'], 3), q('c', ['objem'])].map((x) => [x.id, x]));
  it('méně než 3 odpovědi je „neznámé“', () => {
    const mastery = conceptMastery([answer('a', false), answer('a', false)], questions, NOW);
    expect(mastery.get('tlak')).toMatchObject({ answers: 2, level: 'unknown', score: 0 });
    expect(mastery.has('objem')).toBe(false);
  });
  it('úrovně podle skóre', () => {
    expect(masteryLevel(0.9, 5)).toBe('strong');
    expect(masteryLevel(0.6, 5)).toBe('medium');
    expect(masteryLevel(0.3, 5)).toBe('weak');
    expect(masteryLevel(1, 2)).toBe('unknown');
  });
  it('čerstvé odpovědi váží víc než staré', () => {
    const improving = conceptMastery([answer('a', false, 90), answer('a', false, 90), answer('a', true), answer('a', true)], questions, NOW);
    const declining = conceptMastery([answer('a', true, 90), answer('a', true, 90), answer('a', false), answer('a', false)], questions, NOW);
    expect(improving.get('tlak')!.score).toBeGreaterThan(0.8);
    expect(declining.get('tlak')!.score).toBeLessThan(0.2);
  });
  it('těžší otázky váží víc', () => {
    const mastery = conceptMastery([answer('a', false), answer('b', true), answer('a', false), answer('b', true)], questions, NOW);
    expect(mastery.get('tlak')!.score).toBeCloseTo(1.5 / 2.5, 5);
    expect(mastery.get('objem')!.score).toBe(1);
  });
  it('neznámé otázky se ignorují', () => {
    expect(conceptMastery([answer('mental:mod', true)], questions, NOW).size).toBe(0);
  });
  it('nejslabší uzly: špatné skóre před neznámými a neviděnými', () => {
    const mastery = new Map([
      ['a', { score: 0.9, answers: 5, level: 'strong' as const }],
      ['b', { score: 0.2, answers: 5, level: 'weak' as const }],
      ['c', { score: 0.5, answers: 1, level: 'unknown' as const }],
    ]);
    expect(weakestConcepts(['a', 'b', 'c', 'd'], mastery, 3)).toEqual(['b', 'a', 'c']);
    expect(weakestConcepts(['a', 'b', 'c', 'd'], mastery, 4)[3]).toBe('d');
  });
});

describe('série a denní statistiky', () => {
  it('série počítá po sobě jdoucí dny do dneška', () => {
    expect(streakDays([NOW, NOW - DAY, NOW - 2 * DAY, NOW - 4 * DAY], NOW)).toBe(3);
  });
  it('dnešek bez odpovědi sérii ještě nepřeruší', () => {
    expect(streakDays([NOW - DAY, NOW - 2 * DAY], NOW)).toBe(2);
    expect(streakDays([NOW - 2 * DAY], NOW)).toBe(0);
    expect(streakDays([], NOW)).toBe(0);
  });
  it('denní souhrn včetně prázdných dní', () => {
    const stats = dailyStats([answer('a', true, 0, 4000), answer('a', false, 0, 8000), answer('a', true, 2, 2000)], NOW, 3);
    expect(stats.map((s) => s.total)).toEqual([1, 0, 2]);
    expect(stats[2]).toMatchObject({ correct: 1, avgSeconds: 6 });
    expect(stats[1]!.avgSeconds).toBe(0);
  });
});

describe('splnění modulů', () => {
  const modules = [{ id: 'a', prerequisites: [] }, { id: 'b', prerequisites: ['a'] }, { id: 'c', prerequisites: ['b'] }];
  it('modul je splněný až se zkouškou i prerekvizitami', () => {
    expect([...completedModules(modules, new Set(['b', 'c']))]).toEqual([]);
    expect([...completedModules(modules, new Set(['a', 'c']))]).toEqual(['a']);
    expect([...completedModules(modules, new Set(['c', 'b', 'a']))].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('výběr otázek', () => {
  const questions = [q('a', ['x']), q('b', ['x']), q('c', ['y']), q('d', ['z']), q('e', ['x', 'y'])];
  it('zkouška pokryje všechny uzly a nepřekročí počet', () => {
    for (let seed = 0; seed < 20; seed++) {
      let s = seed + 1;
      const rng = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      const picked = pickExamQuestions(questions, ['x', 'y', 'z'], 3, rng);
      expect(picked).toHaveLength(3);
      expect(new Set(picked.map((p) => p.id)).size).toBe(3);
      const covered = new Set(picked.flatMap((p) => p.conceptIds));
      expect(['x', 'y', 'z'].every((c) => covered.has(c))).toBe(true);
    }
  });
  it('když je otázek méně než požadováno, vrátí všechny', () => {
    expect(pickExamQuestions(questions, ['x', 'y', 'z'], 40)).toHaveLength(5);
  });
  it('fronta opakování: karty po termínu, pak nové z otevřených lekcí', () => {
    const all = [q('a', ['x'], 1, 'l1'), q('b', ['x'], 1, 'l1'), q('c', ['y'], 1, 'l2'), q('d', ['z'], 1, 'l1')];
    const queue = buildReviewQueue({
      questions: all,
      cards: [{ questionId: 'a', due: NOW - DAY }, { questionId: 'b', due: NOW + DAY }, { questionId: 'smazana', due: NOW - DAY }],
      startedLessonIds: new Set(['l1']),
      now: NOW,
    });
    expect(queue.due.map((x) => x.id)).toEqual(['a']);
    expect(queue.fresh.map((x) => x.id)).toEqual(['d']); // b má kartu, c je z neotevřené lekce
  });
  it('fronta respektuje limity', () => {
    const all = Array.from({ length: 30 }, (_, i) => q(`q${i}`, ['x']));
    const cards = all.slice(0, 15).map((x, i) => ({ questionId: x.id, due: NOW - i * 1000 }));
    const queue = buildReviewQueue({ questions: all, cards, startedLessonIds: new Set(['l1']), now: NOW, maxTotal: 12, maxNew: 5 });
    expect(queue.due).toHaveLength(12);
    expect(queue.due[0]!.id).toBe('q14'); // nejstarší termín první
    expect(queue.fresh).toHaveLength(0);
    const second = buildReviewQueue({ questions: all, cards: cards.slice(0, 3), startedLessonIds: new Set(['l1']), now: NOW, maxTotal: 12, maxNew: 5 });
    expect(second.fresh).toHaveLength(5);
  });
});
