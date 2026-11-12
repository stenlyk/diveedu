/** Zápis odpovědi: historie odpovědí + stav karty pro rozložené opakování. */
import type { Question } from '../content/schema';
import { type AnswerRow, db } from '../db/db';
import { autoGrade, type Grade, schedule, type StoredCard } from './scheduler';

export interface Recorded {
  /** Stav karty před touto odpovědí – pro případné přehodnocení uživatelem. */
  previous: StoredCard | undefined;
  grade: Grade;
}

export async function recordAnswer(question: Question, correct: boolean, durationMs: number, mode: AnswerRow['mode'], now = Date.now()): Promise<Recorded> {
  const grade = autoGrade(correct, durationMs, question.type);
  const existing = await db.cards.get(question.id);
  const next = schedule(existing?.state, grade, new Date(now));
  await db.transaction('rw', db.answers, db.cards, async () => {
    await db.answers.add({ questionId: question.id, at: now, correct, durationMs, mode });
    await db.cards.put({ questionId: question.id, due: next.due, state: next.state });
  });
  return { previous: existing?.state, grade };
}

/** Uživatel přepsal automatické hodnocení (např. „bylo to těžké“). */
export async function regrade(questionId: string, previous: StoredCard | undefined, grade: Grade, now = Date.now()): Promise<void> {
  const next = schedule(previous, grade, new Date(now));
  await db.cards.put({ questionId, due: next.due, state: next.state });
}
