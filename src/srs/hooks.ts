import { useMemo } from 'react';
import { content, questionsById } from '../content';
import { db } from '../db/db';
import { useLiveQuery } from '../db/useLiveQuery';
import { buildReviewQueue, completedModules, conceptMastery, type Mastery } from './mastery';

export function useAnswers() {
  return useLiveQuery(() => db.answers.toArray(), []);
}

/** Zvládnutí všech uzlů z historie odpovědí; undefined, dokud se data nenačtou. */
export function useMastery(): Map<string, Mastery> | undefined {
  const answers = useAnswers();
  return useMemo(() => (answers ? conceptMastery(answers, questionsById, Date.now()) : undefined), [answers]);
}

export function useReviewQueue() {
  const cards = useLiveQuery(() => db.cards.toArray(), []);
  const progress = useLiveQuery(() => db.progress.toArray(), []);
  return useMemo(() => {
    if (!cards || !progress) return undefined;
    return buildReviewQueue({ questions: content.questions, cards, startedLessonIds: new Set(progress.map((row) => row.lessonId)), now: Date.now() });
  }, [cards, progress]);
}

/** Moduly se složenou zkouškou. */
export function usePassedModules(): Set<string> | undefined {
  const attempts = useLiveQuery(() => db.examAttempts.toArray(), []);
  return useMemo(() => (attempts ? completedModules(content.modules, new Set(attempts.filter((a) => a.passed).map((a) => a.moduleId))) : undefined), [attempts]);
}
