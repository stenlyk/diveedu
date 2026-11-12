import { formatCs } from '@diveedu/calc';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, Card, ReviewBadge } from '../components/ui';
import { lessonsById } from '../content';
import type { Question } from '../content/schema';
import { type AnswerRow, db } from '../db/db';
import { checkNumeric, generateVariant, renderPrompt } from './numeric';

/** Typy otázek, které engine umí. Ostatní typy přibudou s obsahem, který je potřebuje. */
export const SUPPORTED_TYPES: ReadonlySet<Question['type']> = new Set(['choice', 'why', 'multi', 'numeric', 'order', 'match', 'findError']);

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
      ) : question.type === 'order' ? (
        <OrderBody question={question} locked={verdict !== null} onAnswer={answer} />
      ) : question.type === 'match' ? (
        <MatchBody question={question} locked={verdict !== null} onAnswer={answer} />
      ) : (
        <FindErrorBody question={question} locked={verdict !== null} onAnswer={answer} />
      )}
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

/** Seřaď: klepáním skládáš postup; klepnutím na složený krok ho vrátíš zpět. */
function OrderBody({ question, locked, onAnswer }: { question: Extract<Question, { type: 'order' }>; locked: boolean; onAnswer: (correct: boolean) => void }) {
  const pool = useMemo(() => shuffled(question.items.map((_, i) => i)), [question]);
  const [picked, setPicked] = useState<number[]>([]);
  const rest = pool.filter((i) => !picked.includes(i));
  const row = 'flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 py-2 text-left';
  return (
    <div>
      <h2 className="text-lg font-semibold">{question.prompt}</h2>
      <p className="mt-1 text-sm text-muted">Klepej na kroky ve správném pořadí.</p>
      <ol className="mt-4 space-y-2" aria-label="Tvoje pořadí">
        {picked.map((item, position) => {
          const ok = item === position;
          return (
            <li key={item}>
              <button type="button" disabled={locked} onClick={() => setPicked(picked.filter((i) => i !== item))} className={`${row} ${!locked ? 'border-accent bg-accent/10' : ok ? 'border-ok bg-ok/10' : 'border-danger bg-danger/10'}`}>
                <span className="font-bold tabular-nums">{position + 1}.</span><span>{question.items[item]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {rest.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Zbývající kroky">
          {rest.map((item) => (
            <li key={item}><button type="button" disabled={locked} onClick={() => setPicked([...picked, item])} className={`${row} border-border`}>{question.items[item]}</button></li>
          ))}
        </ul>
      )}
      {!locked && <Button className="mt-4 w-full sm:w-auto" disabled={rest.length > 0} onClick={() => onAnswer(picked.every((item, position) => item === position))}>Potvrdit</Button>}
      {locked && (
        <div className="mt-3 text-sm">
          <div className="font-semibold">Správné pořadí:</div>
          <ol className="list-decimal pl-5 text-muted">{question.items.map((item) => <li key={item}>{item}</li>)}</ol>
        </div>
      )}
    </div>
  );
}

/** Přiřaď: ke každé položce vlevo vyber odpovídající z nabídky. */
function MatchBody({ question, locked, onAnswer }: { question: Extract<Question, { type: 'match' }>; locked: boolean; onAnswer: (correct: boolean) => void }) {
  const rights = useMemo(() => shuffled(question.pairs.map((pair) => pair.right)), [question]);
  const [chosen, setChosen] = useState<string[]>(() => question.pairs.map(() => ''));
  return (
    <div>
      <h2 className="text-lg font-semibold">{question.prompt}</h2>
      <ul className="mt-4 space-y-3">
        {question.pairs.map((pair, i) => {
          const ok = chosen[i] === pair.right;
          return (
            <li key={pair.left} className={`rounded-xl border-2 p-3 ${!locked ? 'border-border' : ok ? 'border-ok bg-ok/10' : 'border-danger bg-danger/10'}`}>
              <label className="block font-medium" htmlFor={`match-${i}`}>{pair.left}</label>
              <select id={`match-${i}`} disabled={locked} value={chosen[i]} onChange={(event) => setChosen(chosen.map((c, j) => (j === i ? event.target.value : c)))} className="mt-2 min-h-12 w-full rounded-xl border-2 border-border bg-bg px-3">
                <option value="">— vyber —</option>
                {rights.map((right) => <option key={right} value={right}>{right}</option>)}
              </select>
              {locked && !ok && <p className="mt-1 text-sm text-muted">Správně: {pair.right}</p>}
            </li>
          );
        })}
      </ul>
      {!locked && <Button className="mt-4 w-full sm:w-auto" disabled={chosen.some((c) => c === '')} onClick={() => onAnswer(question.pairs.every((pair, i) => chosen[i] === pair.right))}>Potvrdit</Button>}
    </div>
  );
}

/** Najdi chybu: označ položky, které jsou v plánu nebo postupu špatně. */
function FindErrorBody({ question, locked, onAnswer }: { question: Extract<Question, { type: 'findError' }>; locked: boolean; onAnswer: (correct: boolean) => void }) {
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const toggle = (i: number) => {
    const next = new Set(marked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setMarked(next);
  };
  return (
    <div>
      <h2 className="text-lg font-semibold">{question.prompt}</h2>
      <p className="mt-1 text-sm text-muted">Označ všechny řádky, které obsahují chybu.</p>
      <ul className="mt-4 space-y-2">
        {question.items.map((item, i) => {
          const chosen = marked.has(i);
          const state = !locked ? (chosen ? 'border-warn bg-warn/10' : 'border-border') : item.isError ? 'border-danger bg-danger/10' : chosen ? 'border-warn bg-warn/10' : 'border-border opacity-70';
          return (
            <li key={item.text}>
              <button type="button" disabled={locked} aria-pressed={chosen} onClick={() => toggle(i)} className={`min-h-12 w-full rounded-xl border-2 px-4 py-2 text-left ${state}`}>
                <span className="block">{locked && item.isError ? '✗ ' : ''}{item.text}</span>
                {locked && item.explanation && <span className="mt-1 block text-sm text-muted">{item.explanation}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {!locked && <Button className="mt-4 w-full sm:w-auto" disabled={marked.size === 0} onClick={() => onAnswer(question.items.every((item, i) => item.isError === marked.has(i)))}>Potvrdit</Button>}
    </div>
  );
}
