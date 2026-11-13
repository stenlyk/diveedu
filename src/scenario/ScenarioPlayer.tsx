import { formatCs } from '@diveedu/calc';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Card, ReviewBadge } from '../components/ui';
import { conceptsById } from '../content';
import type { Scenario } from '../content/schema';
import { db } from '../db/db';
import { debrief, decide, nodeOf, type ScenarioState, startScenario } from './engine';
import { useBreathing } from './useBreathing';

const VERDICT = { good: { mark: '✓', css: 'text-ok', label: 'správně' }, ok: { mark: '◐', css: 'text-warn', label: 'přijatelné' }, bad: { mark: '✗', css: 'text-danger', label: 'chyba' } } as const;
const OUTCOME = { success: { title: 'Zvládnuto', css: 'border-ok' }, partial: { title: 'S odřenýma ušima', css: 'border-warn' }, fail: { title: 'Nezvládnuto', css: 'border-danger' } } as const;
const vibrate = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern); } catch { /* haptika není všude */ } };

/**
 * Pořadí možností na obrazovce: pootočené podle id uzlu, aby správná možnost nebyla vždy první.
 * Je deterministické, takže se při překreslení nemění.
 */
export function displayOrder(nodeId: string, count: number): number[] {
  let hash = 0;
  for (const char of nodeId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: count }, (_, k) => (k + hash) % count);
}

/**
 * Přehrávač rozhodovacího scénáře. Možnosti jsou velká tlačítka ve spodní části obrazovky (ovládání jedním palcem);
 * nulová viditelnost zatemní obrazovku, zvuk dechu a vibrace jsou volitelné.
 */
export function ScenarioPlayer({ scenario }: { scenario: Scenario }) {
  const [state, setState] = useState<ScenarioState | null>(null);
  const [sound, setSound] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ verdict: keyof typeof VERDICT; text: string } | null>(null);
  const saved = useRef(false);

  const node = state && !state.finished ? nodeOf(scenario, state.nodeId) : null;
  const lastBad = state?.decisions[state.decisions.length - 1]?.verdict === 'bad';
  useBreathing(sound && node !== null, lastBad ? 24 : 12);

  const apply = (choice: number | 'timeout') => {
    if (!state) return;
    const next = decide(scenario, state, choice);
    const decision = next.decisions[next.decisions.length - 1]!;
    setLastFeedback({ verdict: decision.verdict, text: decision.feedback });
    vibrate(decision.verdict === 'bad' ? [80, 60, 80] : 30);
    setState(next);
  };

  // Časový limit na rozhodnutí.
  useEffect(() => {
    if (!node?.timeLimitSec) { setRemaining(null); return; }
    const deadline = Date.now() + node.timeLimitSec * 1000;
    setRemaining(node.timeLimitSec);
    const timer = setInterval(() => {
      const left = (deadline - Date.now()) / 1000;
      if (left <= 0) { clearInterval(timer); apply('timeout'); } else setRemaining(left);
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, state?.decisions.length]);

  // Výsledek se uloží jednou; bezchybný průchod se počítá jako správná odpověď.
  useEffect(() => {
    if (!state?.finished || saved.current) return;
    saved.current = true;
    void db.answers.add({ questionId: `scenario:${scenario.id}`, at: Date.now(), correct: debrief(state).clean, durationMs: Math.round(state.elapsedMin * 60_000), mode: 'scenario' }).catch(() => undefined);
  }, [state, scenario.id]);

  const begin = () => { saved.current = false; setLastFeedback(null); setState(startScenario(scenario)); };

  if (!state) {
    return (
      <Card>
        {scenario.needs_review && <div className="mb-2"><ReviewBadge /></div>}
        <p>{scenario.intro}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">Plyn</dt><dd className="font-semibold tabular-nums">{scenario.setup.startBar} bar</dd></div>
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">Hloubka</dt><dd className="font-semibold tabular-nums">{scenario.setup.depthM} m</dd></div>
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">Lahve</dt><dd className="font-semibold tabular-nums">{scenario.setup.tankLiters} l</dd></div>
        </dl>
        <label className="mt-4 flex min-h-12 items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={sound} onChange={(event) => setSound(event.target.checked)} />
          Zvuk dechu
        </label>
        <p className="text-sm text-muted">Každé rozhodnutí stojí čas a plyn. Některá rozhodnutí mají časový limit.</p>
        <Button className="mt-4 w-full" onClick={begin}>Začít scénář</Button>
      </Card>
    );
  }

  if (state.finished) {
    const summary = debrief(state);
    const outcome = OUTCOME[state.finished.outcome];
    return (
      <div data-testid="scenario-debrief">
        <Card className={`border-2 ${outcome.css}`}>
          <div className="text-sm text-muted">Konec scénáře</div>
          <h2 className="text-2xl font-semibold" data-testid="scenario-outcome">{outcome.title}</h2>
          <p className="mt-2">{state.finished.text}</p>
          <p className="mt-2 text-sm text-muted tabular-nums">Čas {formatCs(state.elapsedMin, 0)} min · zbylo {formatCs(state.gasBar, 0)} bar · {summary.good} správně, {summary.ok} přijatelně, {summary.bad} chyb</p>
        </Card>
        <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Rozbor rozhodnutí</h3>
        <ol className="space-y-2">
          {state.decisions.map((decision, i) => (
            <li key={i} className="rounded-xl border border-border bg-surface p-3">
              <div className="text-sm text-muted">{nodeOf(scenario, decision.nodeId).text}</div>
              <div className="mt-1 font-medium"><span className={VERDICT[decision.verdict].css}>{VERDICT[decision.verdict].mark}</span> {decision.choice ?? 'Čas vypršel – nerozhodl ses'}</div>
              <p className="mt-1 text-sm">{decision.feedback}</p>
              <div className="mt-1 text-xs tabular-nums text-muted">Po rozhodnutí {formatCs(decision.gasAfterBar, 0)} bar</div>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {scenario.conceptIds.map((id) => <Link key={id} to={`/graf/${id}`} className="text-accent underline underline-offset-4">{conceptsById.get(id)?.label ?? id}</Link>)}
        </p>
        <Button className="mt-4 w-full sm:w-auto" variant="secondary" onClick={begin}>Zkusit znovu</Button>
      </div>
    );
  }

  const dark = node!.darkness === 'black';
  const lowGas = state.gasBar < scenario.setup.startBar * 0.3;
  return (
    <div className={`-mx-4 flex min-h-[70dvh] flex-col px-4 pb-4 transition-colors duration-700 md:mx-0 md:rounded-2xl md:p-5 ${dark ? 'bg-black text-neutral-300' : node!.darkness === 'dim' ? 'bg-[#1c1a12]' : ''}`} data-testid="scenario-play" data-darkness={node!.darkness}>
      <div className="flex items-center justify-between gap-3 py-2 text-sm tabular-nums">
        <span className={lowGas ? 'font-semibold text-danger' : ''} data-testid="scenario-gas">{formatCs(state.gasBar, 0)} bar</span>
        <span className="h-2 flex-1 overflow-hidden rounded-[2px] bg-border"><span className={`block h-2 ${lowGas ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${(state.gasBar / scenario.setup.startBar) * 100}%`, transition: 'width 400ms' }} /></span>
        <span>{formatCs(state.elapsedMin, 0)} min</span>
        <button type="button" className="min-h-11 px-2" aria-pressed={sound} aria-label={sound ? 'Vypnout zvuk' : 'Zapnout zvuk'} onClick={() => setSound(!sound)}>{sound ? '🔊' : '🔇'}</button>
      </div>
      {dark && <Badge tone="warn">nulová viditelnost – vidíš jen to, co nahmatáš</Badge>}
      {lastFeedback && <p className={`mt-2 text-sm ${VERDICT[lastFeedback.verdict].css}`} role="status">{VERDICT[lastFeedback.verdict].mark} {lastFeedback.text}</p>}
      <p className="mt-4 text-lg leading-relaxed" data-testid="scenario-text">{node!.text}</p>
      {remaining !== null && (
        <div className="mt-3" aria-label={`Zbývá ${Math.ceil(remaining)} sekund`}>
          <div className="h-1.5 overflow-hidden rounded-[2px] bg-border"><div className={`h-1.5 ${remaining < 5 ? 'bg-danger' : 'bg-warn'}`} style={{ width: `${(remaining / node!.timeLimitSec!) * 100}%`, transition: 'width 200ms linear' }} /></div>
        </div>
      )}
      {/* Možnosti dole, v dosahu palce. */}
      <ul className="mt-auto space-y-2 pt-6">
        {displayOrder(node!.id, node!.options.length).map((i) => ({ option: node!.options[i]!, i })).map(({ option, i }) => (
          <li key={option.text}>
            <button type="button" onClick={() => apply(i)} className={`min-h-16 w-full rounded-2xl border-2 px-4 py-3 text-left text-base font-medium active:border-accent ${dark ? 'border-neutral-700 bg-neutral-950' : 'border-border bg-surface'}`}>{option.text}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
