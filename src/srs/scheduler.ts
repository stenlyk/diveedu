/** Rozložené opakování: tenká vrstva nad ts-fsrs. Čisté funkce, čas se předává zvenku. */
import { type Card, createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';
import type { Question } from '../content/schema';

export type Grade = 'again' | 'hard' | 'good' | 'easy';
const RATING = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy } as const;

// Bez náhodného rozptylu intervalů: plán je pak předvídatelný a testovatelný.
const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

export type StoredCard = Record<string, unknown>;

function restore(stored: StoredCard | undefined, now: Date): Card {
  if (!stored) return createEmptyCard(now);
  return {
    ...(stored as unknown as Card),
    due: new Date(stored.due as string),
    last_review: stored.last_review ? new Date(stored.last_review as string) : undefined,
  };
}

export interface Scheduled {
  state: StoredCard;
  /** Kdy má karta přijít znovu (epoch ms). */
  due: number;
}

/** Ohodnotí kartu a vrátí její nový stav. Bez předchozího stavu vzniká nová karta. */
export function schedule(stored: StoredCard | undefined, grade: Grade, now: Date): Scheduled {
  const { card } = scheduler.next(restore(stored, now), now, RATING[grade]);
  return { state: JSON.parse(JSON.stringify(card)) as StoredCard, due: card.due.getTime() };
}

const NUMERIC_TYPES: ReadonlySet<Question['type']> = new Set(['numeric', 'order', 'match', 'findError']);

/**
 * Hodnocení odvozené z výsledku a času: špatně → again; správně pomalu → hard;
 * správně → good; správně rychle → easy. Počítací a skládací otázky mají delší limity.
 */
export function autoGrade(correct: boolean, durationMs: number, type: Question['type']): Grade {
  if (!correct) return 'again';
  const [fast, slow] = NUMERIC_TYPES.has(type) ? [20_000, 90_000] : [8_000, 30_000];
  if (durationMs <= fast) return 'easy';
  if (durationMs >= slow) return 'hard';
  return 'good';
}
