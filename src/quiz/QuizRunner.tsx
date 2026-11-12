import { formatCs } from '@diveedu/calc';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, Card, ReviewBadge } from '../components/ui';
import { lessonsById } from '../content';
import type { Question } from '../content/schema';
import { type AnswerRow, db } from '../db/db';
import { checkNumeric, generateVariant, renderPrompt } from './numeric';

/** Typy otázek, které engine umí. Ostatní typy přibudou s obsahem, který je potřebuje. */
export const SUPPORTED_TYPES: ReadonlySet<Question['type']> = new Set(['choice', 'why', 'multi', 'numeric']);

export interface QuizResult {
  total: number;
  correct: number;
  wrongQuestionIds: string[];
}

interface Props {
  questions: Question[];
  mode: AnswerRow['mode'];
  onFinish?: (result: QuizResult) => void;
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function QuizRunner({ questions, mode, onFinish }: Props) {
  const usable = useMemo(() => questions.filter((question) => SUPPORTED_TYPES.has(question.type)), [questions]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState<QuizResult>({ total: 0, correct: 0, wrongQuestionIds: [] });
  const question = usable[index];

  if (usable.length === 0) return <p className="text-muted">Pro tento výběr zatím nejsou žádné otázky.</p>;
  if (!question) {
    return (
      <Card>
        <div className="text-sm text-muted">Hotovo</div>
        <div className="text-3xl font-bold" data-testid="quiz-score">{score.correct} / {score.total}</div>
        <p className="mt-2 text-muted">
          {score.correct === score.total ? 'Všechno správně.' : 'Chyby tě vedou zpět na konkrétní princip – projdi si odkazy u špatných odpovědí.'}
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => { setIndex(0); setScore({ total: 0, correct: 0, wrongQuestionIds: [] }); }}>Znovu</Button>
      </Card>
    );
  }

  const next = (correct: boolean) => {
    const updated = {
      total: score.total + 1,
      correct: score.correct + (correct ? 1 : 0),
      wrongQuestionIds: correct ? score.wrongQuestionIds : [...score.wrongQuestionIds, question.id],
    };
    setScore(updated);
    setIndex(index + 1);
    if (index + 1 >= usable.length) onFinish?.(updated);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>Otázka {index + 1} z {usable.length}</span>
        {question.needs_review && <ReviewBadge />}
      </div>
      <QuestionView key={`${question.id}-${index}`} question={question} mode={mode} onNext={next} />
    </div>
  );
}

function QuestionView({ question, mode, onNext }: { question: Question; mode: AnswerRow['mode']; onNext: (correct: boolean) => void }) {
  const startedAt = useRef(Date.now());
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const answer = (correct: boolean) => {
    setVerdict(correct);
    void db.answers
      .add({ questionId: question.id, at: Date.now(), correct, durationMs: Date.now() - startedAt.current, mode })
      .catch(() => undefined);
  };
  useEffect(() => {
    if (verdict !== null) nextRef.current?.focus();
  }, [verdict]);

  const lesson = question.backToLessonId ? lessonsById.get(question.backToLessonId) : undefined;
  return (
    <Card>
      {question.type === 'numeric' ? (
        <NumericBody question={question} locked={verdict !== null} onAnswer={answer} />
      ) : question.type === 'choice' || question.type === 'why' || question.type === 'multi' ? (
        <ChoiceBody question={question} locked={verdict !== null} onAnswer={answer} />
      ) : null}
      {verdict !== null && (
        <div className="mt-4" role="status">
          <div className={`font-semibold ${verdict ? 'text-ok' : 'text-danger'}`}>{verdict ? '✓ Správně' : '✗ Špatně'}</div>
          <p className="mt-1 text-sm text-muted">{question.explanation}</p>
          {!verdict && lesson && (
            <Link to={`/uceni/${lesson.id}`} className="mt-2 inline-block text-sm text-accent underline underline-offset-4">
              Zpět k principu: {lesson.title}
            </Link>
          )}
          <div className="mt-4">
            <Button ref={nextRef} className="w-full sm:w-auto" onClick={() => onNext(verdict)}>Další</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

type ChoiceQuestion = Extract<Question, { type: 'choice' | 'why' | 'multi' }>;

function ChoiceBody({ question, locked, onAnswer }: { question: ChoiceQuestion; locked: boolean; onAnswer: (correct: boolean) => void }) {
  const options = useMemo(() => shuffled(question.options), [question]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const multi = question.type === 'multi';

  const submit = (chosen: Set<number>) => onAnswer(options.every((option, i) => option.correct === chosen.has(i)));
  const toggle = (i: number) => {
    if (locked) return;
    if (!multi) {
      setSelected(new Set([i]));
      submit(new Set([i]));
      return;
    }
    const nextSet = new Set(selected);
    if (nextSet.has(i)) nextSet.delete(i);
    else nextSet.add(i);
    setSelected(nextSet);
  };

  // Klávesy 1–9 vybírají možnost (desktop).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const n = Number(event.key);
      if (!locked && n >= 1 && n <= options.length) toggle(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div>
      <h2 className="text-lg font-semibold">{question.prompt}</h2>
      {multi && <p className="mt-1 text-sm text-muted">Vyber všechny správné možnosti.</p>}
      <ul className="mt-4 space-y-2">
        {options.map((option, i) => {
          const chosen = selected.has(i);
          const state = !locked ? (chosen ? 'border-accent bg-accent/10' : 'border-border') : option.correct ? 'border-ok bg-ok/10' : chosen ? 'border-danger bg-danger/10' : 'border-border opacity-70';
          return (
            <li key={option.text}>
              <button
                type="button"
                disabled={locked}
                aria-pressed={chosen}
                onClick={() => toggle(i)}
                className={`flex min-h-14 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${state}`}
              >
                <span className="mt-0.5 hidden h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border text-xs text-muted md:flex">{i + 1}</span>
                <span>
                  <span className="block">{locked && option.correct ? '✓ ' : locked && chosen ? '✗ ' : ''}{option.text}</span>
                  {locked && (chosen || option.correct) && option.explanation && <span className="mt-1 block text-sm text-muted">{option.explanation}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {multi && !locked && <Button className="mt-4 w-full sm:w-auto" disabled={selected.size === 0} onClick={() => submit(selected)}>Potvrdit</Button>}
    </div>
  );
}

type NumericQuestion = Extract<Question, { type: 'numeric' }>;

function NumericBody({ question, locked, onAnswer }: { question: NumericQuestion; locked: boolean; onAnswer: (correct: boolean) => void }) {
  const variant = useMemo(() => generateVariant(question.template), [question]);
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  const { template } = question;

  const submit = () => {
    const verdict = checkNumeric(input, variant.answer, template.tolerance);
    if (verdict === 'invalid') return setInvalid(true);
    setInvalid(false);
    onAnswer(verdict === 'correct');
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); if (!locked) submit(); }}>
      <h2 className="text-lg font-semibold">{renderPrompt(question.prompt, variant.values)}</h2>
      <div className="mt-4 flex items-center gap-2">
        <input
          inputMode="decimal"
          autoComplete="off"
          aria-label={`Odpověď v jednotkách ${template.unit}`}
          aria-invalid={invalid}
          className="min-h-12 w-36 rounded-xl border-2 border-border bg-bg px-4 text-lg tabular-nums focus:border-accent"
          value={input}
          disabled={locked}
          onChange={(event) => setInput(event.target.value)}
        />
        <span className="text-muted">{template.unit}</span>
        {!locked && <Button type="submit" disabled={input.trim() === ''}>Ověřit</Button>}
      </div>
      {invalid && <p className="mt-2 text-sm text-danger">Zadej číslo, například 4,5.</p>}
      {locked && (
        <p className="mt-3 text-sm">
          Správný výsledek: <strong className="tabular-nums">{formatCs(variant.answer, template.decimals)} {template.unit}</strong>
          <span className="text-muted"> (tolerance ± {formatCs(template.tolerance, 2)} {template.unit})</span>
        </p>
      )}
    </form>
  );
}
