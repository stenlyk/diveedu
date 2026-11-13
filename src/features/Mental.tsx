import { formatCs } from '@diveedu/calc';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Disclaimer } from '../components/Disclaimer';
import { Button, Card } from '../components/ui';
import { db } from '../db/db';
import { useSettings } from '../db/settings';
import { checkMental, generateTask, MAX_LEVEL, MENTAL_TASKS, type MentalTask, nextLevel } from '../train/mental';

const SESSION = 10;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'] as const;

interface Done { task: MentalTask; correct: boolean; seconds: number }

/** Vlastní číselná klávesnice: režim na čas nesmí čekat na systémovou. */
function Numpad({ onKey, onSubmit, disabled }: { onKey: (key: string) => void; onSubmit: () => void; disabled: boolean }) {
  return (
    <div className="mx-auto mt-4 grid max-w-xs grid-cols-3 gap-2" aria-label="Číselná klávesnice">
      {KEYS.map((key) => (
        <button key={key} type="button" disabled={disabled} onClick={() => onKey(key)} aria-label={key === '⌫' ? 'Smazat' : key === ',' ? 'Desetinná čárka' : key} className="h-14 rounded-xl border border-border bg-surface-2 text-2xl font-semibold tabular-nums active:bg-accent/20 disabled:opacity-40">{key}</button>
      ))}
      <Button className="col-span-3 !min-h-14 text-lg" disabled={disabled} onClick={onSubmit}>OK</Button>
    </div>
  );
}

export function Mental() {
  const storedLevel = useSettings((state) => state.mentalLevel);
  const setSetting = useSettings((state) => state.set);
  const [level, setLevel] = useState(storedLevel);
  const [task, setTask] = useState<MentalTask | null>(null);
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [done, setDone] = useState<Done[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  const begin = (startLevel: number, previousId?: string) => {
    setTask(generateTask(startLevel, Math.random, previousId));
    setInput('');
    setVerdict(null);
    setElapsed(0);
    startedAt.current = Date.now();
  };
  const startSession = () => {
    setDone([]);
    setLevel(storedLevel);
    begin(storedLevel);
  };

  useEffect(() => {
    if (!task || verdict !== null) return;
    const timer = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 200);
    return () => clearInterval(timer);
  }, [task, verdict]);

  const submit = useCallback(() => {
    if (!task || verdict !== null) return;
    const correct = checkMental(input, task);
    if (correct === null) return;
    const seconds = (Date.now() - startedAt.current) / 1000;
    setVerdict(correct);
    setElapsed(seconds);
    setDone((list) => [...list, { task, correct, seconds }]);
    void db.answers.add({ questionId: `mental:${task.taskId}`, at: Date.now(), correct, durationMs: Math.round(seconds * 1000), mode: 'mental' }).catch(() => undefined);
  }, [task, verdict, input]);

  const next = useCallback(() => {
    if (!task) return;
    const upcoming = nextLevel(level, done.map((d) => d.correct));
    setLevel(upcoming);
    if (done.length >= SESSION) {
      setTask(null);
      void setSetting('mentalLevel', upcoming);
      return;
    }
    begin(upcoming, task.taskId);
  }, [task, level, done, setSetting]);

  const press = useCallback((key: string) => {
    if (verdict !== null) return;
    setInput((value) => (key === '⌫' ? value.slice(0, -1) : key === ',' && value.includes(',') ? value : (value + key).slice(0, 7)));
  }, [verdict]);

  // Klávesnice na desktopu: číslice, čárka/tečka, Backspace, Enter.
  useEffect(() => {
    if (!task) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') { event.preventDefault(); if (verdict === null) submit(); else next(); }
      else if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === ',' || event.key === '.') press(',');
      else if (event.key === 'Backspace') press('⌫');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task, verdict, submit, next, press]);

  const crumb = (
    <>
      <nav className="text-sm text-muted"><Link to="/trenink" className="underline underline-offset-4">Trénink</Link> › Z hlavy na čas</nav>
      <h1 className="mb-4 mt-1 text-2xl font-semibold tracking-tight">Z hlavy na čas</h1>
    </>
  );

  if (!task) {
    const finished = done.length >= SESSION;
    const correct = done.filter((d) => d.correct).length;
    const avg = done.length ? done.reduce((sum, d) => sum + d.seconds, 0) / done.length : 0;
    return (
      <div className="max-w-2xl">
        {crumb}
        {finished && (
          <Card className="mb-5">
            <div className="text-sm text-muted">Výsledek</div>
            <div className="text-3xl font-semibold" data-testid="mental-score">{correct} / {done.length}</div>
            <p className="text-muted">Průměrně {formatCs(avg, 1)} s na úlohu. Příště začneš na úrovni {level} z {MAX_LEVEL}.</p>
            <ul className="mt-3 space-y-1 text-sm">
              {done.map((d, i) => (
                <li key={i} className="flex justify-between gap-3"><span className={d.correct ? 'text-ok' : 'text-danger'}>{d.correct ? '✓' : '✗'} <span className="text-text">{d.task.prompt}</span></span><span className="shrink-0 tabular-nums text-muted">{formatCs(d.task.answer, d.task.decimals)} {d.task.unit} · {formatCs(d.seconds, 0)} s</span></li>
              ))}
            </ul>
          </Card>
        )}
        <Card>
          <p>{SESSION} úloh. Počítej z hlavy a zaokrouhluj – tolerance je ±1 m, ±0,02 bar a ±1 %. Obtížnost roste po třech správných v řadě.</p>
          <p className="mt-2 text-sm text-muted">Aktuální úroveň: {storedLevel} z {MAX_LEVEL}. Úroveň 3 předbíhá do modulu Normoxic Trimix (END, hustota); vzorec je vždy v tipu.</p>
          <Button className="mt-4 w-full sm:w-auto" onClick={startSession}>{finished ? 'Další kolo' : 'Začít'}</Button>
        </Card>
        <details className="mt-5">
          <summary className="min-h-11 cursor-pointer font-medium text-accent">Tipy na odhady a zaokrouhlování</summary>
          <dl className="mt-2 space-y-3 text-sm">
            {MENTAL_TASKS.map((def) => <div key={def.id}><dt className="font-semibold">{def.label}</dt><dd className="text-muted">{def.tip}</dd></div>)}
          </dl>
        </details>
        <div className="mt-5"><Disclaimer kind="calc" /></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      {crumb}
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <span>Úloha {Math.min(done.length + (verdict === null ? 1 : 0), SESSION)} z {SESSION} · úroveň {level}</span>
        <span className="font-semibold tabular-nums" aria-label="Čas">{formatCs(elapsed, 1)} s</span>
      </div>
      <Card>
        <h2 className="text-xl font-semibold" data-testid="mental-prompt">{task.prompt}</h2>
        <div className={`mt-4 flex h-16 items-center justify-center rounded-xl border-2 text-3xl font-semibold tabular-nums ${verdict === null ? 'border-border' : verdict ? 'border-ok text-ok' : 'border-danger text-danger'}`} aria-live="polite" data-testid="mental-input">
          {input || <span className="text-muted">–</span>}<span className="ml-2 text-lg font-normal text-muted">{task.unit}</span>
        </div>
        {verdict !== null && (
          <div className="mt-3" role="status">
            <p className={`font-semibold ${verdict ? 'text-ok' : 'text-danger'}`}>{verdict ? '✓ Správně' : '✗ Vedle'} · přesně {formatCs(task.answer, task.decimals)} {task.unit}</p>
            {!verdict && <p className="mt-1 text-sm text-muted">Tip: {task.tip}</p>}
            <Button className="mt-3 w-full" onClick={next}>{done.length >= SESSION ? 'Výsledek' : 'Další'}</Button>
          </div>
        )}
      </Card>
      <Numpad onKey={press} onSubmit={submit} disabled={verdict !== null} />
    </div>
  );
}
