import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Question } from '../content/schema';
import { db } from '../db/db';
import { recordAnswer, regrade } from './record';

const question = { id: 'q1', type: 'choice', conceptIds: ['x'], difficulty: 1, prompt: 'x', explanation: 'x', options: [], sources: [], needs_review: false } as unknown as Question;
const NOW = new Date('2026-11-12T12:00:00').getTime();

beforeEach(async () => {
  await db.answers.clear();
  await db.cards.clear();
});

describe('zápis odpovědi', () => {
  it('uloží odpověď a naplánuje kartu', async () => {
    const recorded = await recordAnswer(question, true, 5000, 'quick', NOW);
    expect(recorded).toMatchObject({ previous: undefined, grade: 'easy' });
    expect(await db.answers.toArray()).toMatchObject([{ questionId: 'q1', correct: true, durationMs: 5000, mode: 'quick', at: NOW }]);
    const card = await db.cards.get('q1');
    expect(card!.due).toBeGreaterThan(NOW);
  });
  it('další odpověď navazuje na předchozí stav karty', async () => {
    await recordAnswer(question, true, 5000, 'quick', NOW);
    const first = await db.cards.get('q1');
    const second = await recordAnswer(question, true, 5000, 'review', first!.due);
    expect(second.previous).toEqual(first!.state);
    expect((await db.cards.get('q1'))!.due).toBeGreaterThan(first!.due);
    expect(await db.answers.count()).toBe(2);
  });
  it('přehodnocení na „těžké“ vrátí kartu dřív', async () => {
    const recorded = await recordAnswer(question, true, 5000, 'review', NOW);
    const easyDue = (await db.cards.get('q1'))!.due;
    await regrade('q1', recorded.previous, 'hard', NOW);
    expect((await db.cards.get('q1'))!.due).toBeLessThan(easyDue);
  });
});
