/**
 * Komponenty dostupné v MDX lekcích. Čísla se do textu dostávají jen přes <Calc> a <Worked>,
 * které volají @diveedu/calc – žádný výsledek se v lekci nepíše ručně.
 */
import * as calc from '@diveedu/calc';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { LocalGraph as LocalGraphView } from '../components/LocalGraph';
import { Tex } from '../components/Math';
import { Steps } from '../components/Steps';
import { Card, ReviewBadge } from '../components/ui';
import { casesById, conceptsById, factsById, formulasById, glossaryByCs, questionsById } from '../content';
import { LESSON_SECTIONS, type Lesson } from '../content/schema';
import { QuizRunner } from '../quiz/QuizRunner';
import { CalcToy } from '../tools/CalcView';
import { calcDefsById } from '../tools/defs';
import { PLAYGROUNDS } from './playgrounds';

type SectionName = (typeof LESSON_SECTIONS)[number];

export const LessonContext = createContext<{ lesson: Lesson; active: SectionName } | null>(null);

function useLesson() {
  const context = useContext(LessonContext);
  if (!context) throw new Error('Komponenta lekce použitá mimo lekci');
  return context;
}

/** Sekce šablony: vykreslí se jen ta právě otevřená. */
function section(name: SectionName) {
  return function Section({ children }: { children?: ReactNode }) {
    const { active } = useLesson();
    if (active !== name) return null;
    return <section className="prose-lesson" data-section={name}>{children}</section>;
  };
}

const fns = calc as unknown as Record<string, (...args: unknown[]) => unknown>;

function compute(fn: string, args: unknown[]): number {
  const value = fns[fn]?.(...args);
  if (typeof value !== 'number') throw new Error(`calc.${fn} nevrátila číslo`);
  return value;
}

function Calc({ fn, args, decimals = 0, unit }: { fn: string; args: unknown[]; decimals?: number; unit?: string }) {
  return (
    <span className="whitespace-nowrap font-semibold tabular-nums" data-calc={fn}>
      {calc.formatCs(compute(fn, args), decimals)}{unit ? ` ${unit}` : ''}
    </span>
  );
}

interface WorkedProps {
  fn: string;
  args: unknown[];
  /** Ručně spočtená reference – kontroluje ji validátor obsahu, nezobrazuje se. */
  expected: number;
  tolerance: number;
  steps?: string;
  unit?: string;
  decimals?: number;
}

function Worked({ fn, args, steps, unit, decimals = 1 }: WorkedProps) {
  const value = compute(fn, args);
  const list = steps ? (fns[steps]?.(...args) as calc.CalcStep[] | undefined) : undefined;
  return (
    <div className="my-4" data-worked={fn}>
      {list && <Steps steps={list} />}
      <div className="mt-3 rounded-xl border-2 border-accent bg-accent/10 px-4 py-3">
        <span className="text-sm text-muted">Výsledek: </span>
        <strong className="text-xl tabular-nums">{calc.formatCs(value, decimals)}{unit ? ` ${unit}` : ''}</strong>
      </div>
    </div>
  );
}

function Formula({ id }: { id: string }) {
  const formula = formulasById.get(id);
  if (!formula) return null;
  return (
    <Card className="my-4">
      <div className="text-sm text-muted">{formula.title}</div>
      <Tex block tex={formula.latex} />
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {formula.variables.map((variable) => (
          <div key={variable.symbol} className="contents">
            <dt><Tex tex={variable.symbol} /></dt>
            <dd className="text-muted">{variable.name} [{variable.unit}]</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Odborný termín se slovníčkovým heslem; při prvním výskytu ukáže anglický ekvivalent. */
function Term({ cs }: { cs: string }) {
  const term = glossaryByCs.get(cs.toLowerCase());
  if (!term) return <strong>{cs}</strong>;
  return (
    <span>
      <strong title={term.definition}>{cs}</strong> <span className="text-muted">({term.en})</span>
    </span>
  );
}

function Playground({ kind }: { kind: string }) {
  const Toy = PLAYGROUNDS[kind];
  const def = calcDefsById.get(kind);
  if (Toy) return <div className="my-2 max-w-none"><Toy /></div>;
  if (def) return <div className="my-2 max-w-none"><CalcToy def={def} /></div>;
  return <p className="text-muted">Hračka „{kind}“ zatím není k dispozici.</p>;
}

function LocalGraph() {
  const { lesson } = useLesson();
  const [conceptId, setConceptId] = useState(lesson.conceptIds[0]!);
  return (
    <div className="max-w-none">
      {lesson.conceptIds.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Pojmy lekce">
          {lesson.conceptIds.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === conceptId}
              onClick={() => setConceptId(id)}
              className={`min-h-11 rounded-full border px-4 text-sm ${id === conceptId ? 'border-accent bg-accent/15 text-text' : 'border-border text-muted'}`}
            >
              {conceptsById.get(id)?.label ?? id}
            </button>
          ))}
        </div>
      )}
      <LocalGraphView conceptId={conceptId} />
    </div>
  );
}

function Fact({ id }: { id: string }) {
  const fact = factsById.get(id);
  if (!fact) return null;
  return (
    <Card className="my-2">
      {fact.needs_review && <div className="mb-2"><ReviewBadge /></div>}
      <p className="!mb-2">{fact.text}</p>
      <p className="!mb-0 text-sm text-muted">Zdroj: {[fact.source.author, fact.source.title, fact.source.year].filter(Boolean).join(', ')}</p>
    </Card>
  );
}

function LessonCheck() {
  const { lesson } = useLesson();
  const questions = lesson.checkQuestionIds.flatMap((id) => questionsById.get(id) ?? []);
  return <div className="max-w-none"><QuizRunner questions={questions} mode="lesson" /></div>;
}

/** Shrnutí pro poslech. Do etapy 6 čte systémový hlas (Web Speech API), funguje i offline. */
function AudioSummaryPlayer() {
  const { lesson } = useLesson();
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(lesson.audioSummary);
    utterance.lang = 'cs-CZ';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };
  return (
    <div>
      {supported && (
        <button type="button" onClick={toggle} className="mb-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-surface-2 px-5 font-semibold">
          {speaking ? '■ Zastavit' : '▶ Přehrát shrnutí'}
        </button>
      )}
      <p>{lesson.audioSummary}</p>
    </div>
  );
}

/** „Co kdyby“: přepínače situací s vysvětlením důsledku. Obsah je v lekci, ne v kódu. */
function WhatIf({ items }: { items: { label: string; effect: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className="!list-none space-y-2 !pl-0">
      {items.map((item, i) => (
        <li key={item.label}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-2 text-left font-medium ${open === i ? 'border-accent bg-accent/10' : 'border-border'}`}>
            <span>Co kdyby… {item.label}</span><span aria-hidden="true">{open === i ? '−' : '+'}</span>
          </button>
          {open === i && <p className="!mb-0 mt-2 rounded-xl bg-surface-2 px-4 py-3">{item.effect}</p>}
        </li>
      ))}
    </ul>
  );
}

function CaseLink({ id }: { id: string }) {
  const study = casesById.get(id);
  if (!study) return null;
  return (
    <Card className="my-2">
      <div className="text-sm text-muted">Případová studie{study.year ? ` · ${study.year}` : ''}</div>
      <Link to={`/pripady/${study.id}`} className="text-lg font-semibold text-accent underline underline-offset-4">{study.title}</Link>
      <p className="!mb-0 mt-1 text-sm text-muted">{study.location}</p>
    </Card>
  );
}

/** Daná konvence nebo zadání (ne výsledek výpočtu) – např. „10 m mořské vody = 1 bar“. */
function Given({ children }: { children?: ReactNode }) {
  return <strong className="whitespace-nowrap">{children}</strong>;
}

export const mdxComponents = {
  Given,
  WhatIf,
  CaseLink,
  Hook: section('Hook'),
  Principle: section('Principle'),
  FormulaSection: section('FormulaSection'),
  WorkedSection: section('WorkedSection'),
  PlaygroundSection: section('PlaygroundSection'),
  Links: section('Links'),
  RealWorld: section('RealWorld'),
  Check: section('Check'),
  AudioSummary: section('AudioSummary'),
  Calc,
  Worked,
  Formula,
  Term,
  Playground,
  LocalGraph,
  Fact,
  LessonCheck,
  AudioSummaryPlayer,
};
