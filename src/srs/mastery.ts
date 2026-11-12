/** Zvládnutí uzlů grafu a související statistiky. Čisté funkce nad seznamem odpovědí. */
import type { Question } from '../content/schema';

export interface AnswerLike {
  questionId: string;
  at: number;
  correct: boolean;
  durationMs: number;
  mode: string;
}

export interface Mastery {
  /** Vážená úspěšnost 0–1. */
  score: number;
  answers: number;
  level: 'unknown' | 'weak' | 'medium' | 'strong';
}

const DAY = 86_400_000;
export const MASTERY_HALF_LIFE_DAYS = 30;
export const MIN_ANSWERS = 3;

export function masteryLevel(score: number, answers: number): Mastery['level'] {
  if (answers < MIN_ANSWERS) return 'unknown';
  if (score >= 0.8) return 'strong';
  if (score >= 0.5) return 'medium';
  return 'weak';
}

/**
 * Zvládnutí uzlu = vážený průměr správnosti odpovědí na otázky, které se uzlu týkají.
 * Váha odpovědi klesá s časem (poločas 30 dní) a roste s obtížností otázky.
 * Méně než 3 odpovědi = „neznámé“, ne „slabé“.
 */
export function conceptMastery(answers: readonly AnswerLike[], questions: ReadonlyMap<string, Question>, now: number): Map<string, Mastery> {
  const sums = new Map<string, { weighted: number; weight: number; count: number }>();
  for (const answer of answers) {
    const question = questions.get(answer.questionId);
    if (!question) continue;
    const ageDays = Math.max(0, now - answer.at) / DAY;
    const weight = Math.pow(0.5, ageDays / MASTERY_HALF_LIFE_DAYS) * (1 + 0.25 * (question.difficulty - 1));
    for (const conceptId of question.conceptIds) {
      const sum = sums.get(conceptId) ?? { weighted: 0, weight: 0, count: 0 };
      sum.weighted += answer.correct ? weight : 0;
      sum.weight += weight;
      sum.count += 1;
      sums.set(conceptId, sum);
    }
  }
  return new Map([...sums].map(([id, sum]) => {
    const score = sum.weighted / sum.weight;
    return [id, { score, answers: sum.count, level: masteryLevel(score, sum.count) }];
  }));
}

/** Nejslabší uzly: nejdřív ty se špatným skóre, neznámé až potom. */
export function weakestConcepts(conceptIds: readonly string[], mastery: ReadonlyMap<string, Mastery>, count: number): string[] {
  const rank = (id: string) => {
    const m = mastery.get(id);
    if (!m) return 2; // nikdy neviděno
    if (m.level === 'unknown') return 1 + m.score * 0.5;
    return m.score;
  };
  return [...conceptIds].sort((a, b) => rank(a) - rank(b)).slice(0, count);
}

const dayKey = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Série dní: kolik dní po sobě (do dneška nebo včerejška) má uživatel aspoň jednu odpověď. */
export function streakDays(answerTimes: readonly number[], now: number): number {
  const days = new Set(answerTimes.map(dayKey));
  let cursor = now;
  if (!days.has(dayKey(cursor))) cursor -= DAY; // dnešek ještě nemusí být splněný
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

export interface DayStat {
  day: string;
  total: number;
  correct: number;
  /** Průměrná doba odpovědi v sekundách. */
  avgSeconds: number;
}

/** Souhrn po dnech za posledních N dní (včetně dní bez odpovědi). */
export function dailyStats(answers: readonly AnswerLike[], now: number, days: number): DayStat[] {
  const byDay = new Map<string, { total: number; correct: number; ms: number }>();
  for (const answer of answers) {
    const key = dayKey(answer.at);
    const stat = byDay.get(key) ?? { total: 0, correct: 0, ms: 0 };
    stat.total += 1;
    stat.correct += answer.correct ? 1 : 0;
    stat.ms += answer.durationMs;
    byDay.set(key, stat);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(now - (days - 1 - i) * DAY);
    const stat = byDay.get(day);
    return { day, total: stat?.total ?? 0, correct: stat?.correct ?? 0, avgSeconds: stat ? stat.ms / stat.total / 1000 : 0 };
  });
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Výběr otázek do zkoušky: nejdřív jedna otázka na každý uzel (aby zkouška pokryla celý modul),
 * zbytek náhodně. Pořadí je promíchané.
 */
export function pickExamQuestions(questions: readonly Question[], conceptIds: readonly string[], count: number, rng: () => number = Math.random): Question[] {
  const pool = shuffle(questions, rng);
  const picked = new Map<string, Question>();
  for (const conceptId of shuffle(conceptIds, rng)) {
    if (picked.size >= count) break;
    const question = pool.find((q) => !picked.has(q.id) && q.conceptIds.includes(conceptId));
    if (question) picked.set(question.id, question);
  }
  for (const question of pool) {
    if (picked.size >= count) break;
    picked.set(question.id, question);
  }
  return shuffle([...picked.values()], rng);
}

export interface CardLike {
  questionId: string;
  due: number;
}

/**
 * Fronta denního opakování: karty po termínu (nejstarší první), pak nové odemčené otázky.
 * Odemčená je otázka z lekce, kterou uživatel otevřel, nebo otázka, na kterou už odpovídal.
 */
export function buildReviewQueue(opts: {
  questions: readonly Question[];
  cards: readonly CardLike[];
  startedLessonIds: ReadonlySet<string>;
  now: number;
  maxTotal?: number;
  maxNew?: number;
}): { due: Question[]; fresh: Question[] } {
  const { questions, cards, startedLessonIds, now, maxTotal = 20, maxNew = 10 } = opts;
  const byId = new Map(questions.map((q) => [q.id, q]));
  const cardIds = new Set(cards.map((card) => card.questionId));
  const due = cards
    .filter((card) => card.due <= now && byId.has(card.questionId))
    .sort((a, b) => a.due - b.due)
    .slice(0, maxTotal)
    .map((card) => byId.get(card.questionId)!);
  const fresh = questions
    .filter((q) => !cardIds.has(q.id) && q.backToLessonId !== undefined && startedLessonIds.has(q.backToLessonId))
    .slice(0, Math.max(0, Math.min(maxNew, maxTotal - due.length)));
  return { due, fresh };
}

/**
 * Splněné moduly: složená zkouška a zároveň splněné všechny prerekvizity.
 * (Zkoušku lze složit kdykoli, ale modul se počítá za splněný až s prerekvizitami.)
 */
export function completedModules(modules: readonly { id: string; prerequisites: string[] }[], examPassed: ReadonlySet<string>): Set<string> {
  const done = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const module of modules) {
      if (!done.has(module.id) && examPassed.has(module.id) && module.prerequisites.every((id) => done.has(id))) {
        done.add(module.id);
        changed = true;
      }
    }
  }
  return done;
}
