import { type CalcStep, formatCs, parseCs, texResult } from '@diveedu/calc';
import { useMemo, useState } from 'react';
import { Tex } from '../components/Math';
import { Steps } from '../components/Steps';
import { Button, SliderField } from '../components/ui';
import { type CalcDef, initialValues, type OutputDef, stepTolerance, toCalcValues, type Values } from './defs';

const TONE = { ok: 'text-ok', warn: 'text-warn', danger: 'text-danger' } as const;
const BAR_TONE = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger' } as const;

function Output({ output }: { output: OutputDef }) {
  const { bar } = output;
  const shown = output.value === null ? 'mimo tabulku' : !Number.isFinite(output.value) ? 'bez limitu' : `${formatCs(output.value, output.decimals)} ${output.unit}`;
  const ratio = bar && output.value !== null && Number.isFinite(output.value) ? Math.max(0, Math.min(1, output.value / bar.max)) : null;
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <dt className="label-ui">{output.label}</dt>
      <dd className={`mt-1 font-mono text-2xl font-medium tabular-nums ${output.tone ? TONE[output.tone] : ''}`} data-output={output.label}>{shown}</dd>
      {bar && ratio !== null && (
        <dd className="relative mt-2 h-1 rounded-[2px] bg-border" aria-hidden="true">
          <span className={`block h-1 rounded-[2px] ${output.tone ? BAR_TONE[output.tone] : 'bg-accent'}`} style={{ width: `${ratio * 100}%`, transition: 'width 150ms ease-out' }} />
          {bar.marks?.map((mark) => (
            <span key={mark.at} className="absolute -top-1 h-4 w-0.5 bg-text" style={{ left: `${(mark.at / bar.max) * 100}%` }}>
              <span className="absolute left-1 top-3.5 text-[10px] text-muted">{mark.label}</span>
            </span>
          ))}
        </dd>
      )}
      {output.note && <dd className={`text-sm text-muted ${bar?.marks ? 'mt-5' : 'mt-1'}`}>{output.note}</dd>}
    </div>
  );
}

function Inputs({ def, shown, onChange }: { def: CalcDef; shown: Values; onChange: (values: Values) => void }) {
  return (
    <div className="space-y-4">
      {def.inputs.map((input) => (
        <SliderField key={input.key} label={input.label} value={shown[input.key]!} min={input.min} max={input.max} step={input.step} unit={input.unit} onChange={(value) => onChange({ ...shown, [input.key]: value })} />
      ))}
    </div>
  );
}

/** Hračka v lekci: posuvníky a živý výsledek. */
export function CalcToy({ def }: { def: CalcDef }) {
  const [shown, setShown] = useState(() => initialValues(def));
  const outputs = def.outputs(toCalcValues(def, shown));
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2" data-toy={def.id}>
      <Inputs def={def} shown={shown} onChange={setShown} />
      <dl className="space-y-3">{outputs.map((output) => <Output key={output.label} output={output} />)}</dl>
    </div>
  );
}

/** Režim „Spočti mi“: výsledek a rozepsaný postup. */
export function CalcSolve({ def }: { def: CalcDef }) {
  const [shown, setShown] = useState(() => initialValues(def));
  const values = toCalcValues(def, shown);
  const steps = useMemo(() => {
    try {
      return def.steps?.(values);
    } catch {
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, JSON.stringify(values)]);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Inputs def={def} shown={shown} onChange={setShown} />
        <dl className="space-y-3">{def.outputs(values).map((output) => <Output key={output.label} output={output} />)}</dl>
      </div>
      {steps && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Postup</h3>
          <Steps steps={steps} />
        </div>
      )}
    </div>
  );
}

function randomShown(def: CalcDef): Values {
  return Object.fromEntries(
    def.inputs.map((input) => {
      const count = Math.floor((input.max - input.min) / input.step + 1e-9);
      return [input.key, Number((input.min + Math.floor(Math.random() * (count + 1)) * input.step).toFixed(6))];
    }),
  );
}

/** Zadání s platným postupem (např. CNS nejde rozepsat mimo tabulku). */
function newTask(def: CalcDef): { shown: Values; steps: CalcStep[] } {
  for (let attempt = 0; attempt < 50; attempt++) {
    const shown = randomShown(def);
    try {
      const steps = def.steps!(toCalcValues(def, shown));
      if (steps.every((step) => Number.isFinite(step.value))) return { shown, steps };
    } catch {
      /* zkus jiné zadání */
    }
  }
  const shown = initialValues(def);
  return { shown, steps: def.steps!(toCalcValues(def, shown)) };
}

/**
 * Režim „Spočítám sám“: aplikace zadá vstupy, uživatel vyplní mezivýsledky i výsledek
 * a dostane zpětnou vazbu u prvního kroku, kde se spletl.
 */
export function CalcPractice({ def }: { def: CalcDef }) {
  const [task, setTask] = useState(() => newTask(def));
  const [answers, setAnswers] = useState<string[]>(() => task.steps.map(() => ''));
  const [checked, setChecked] = useState(false);

  const verdicts = task.steps.map((step, i) => {
    const value = parseCs(answers[i] ?? '');
    return value !== null && Math.abs(value - step.value) <= stepTolerance(step) + 1e-9;
  });
  const firstWrong = verdicts.indexOf(false);
  const reset = () => {
    const next = newTask(def);
    setTask(next);
    setAnswers(next.steps.map(() => ''));
    setChecked(false);
  };

  return (
    <form className="max-w-2xl" onSubmit={(event) => { event.preventDefault(); setChecked(true); }}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Zadání</h3>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {def.inputs.map((input) => (
          <div key={input.key} className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{input.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{String(task.shown[input.key]).replace('.', ',')} {input.unit}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Tvůj výpočet</h3>
      <ol className="mt-2 space-y-3">
        {task.steps.map((step, i) => {
          const last = i === task.steps.length - 1;
          const state = !checked ? 'border-border' : verdicts[i] ? 'border-ok' : 'border-danger';
          return (
            <li key={i} className={`rounded-xl border-2 bg-surface-2 p-3 ${state}`}>
              <label className="block text-sm" htmlFor={`practice-${i}`}>{i + 1}. {step.label}{last ? ' (výsledek)' : ''}</label>
              <div className="mt-2 flex items-center gap-2">
                <input id={`practice-${i}`} inputMode="decimal" autoComplete="off" disabled={checked} value={answers[i]} onChange={(event) => setAnswers(answers.map((a, j) => (j === i ? event.target.value : a)))} className="min-h-12 w-32 rounded-xl border-2 border-border bg-bg px-3 text-lg tabular-nums" />
                <span className="text-muted">{step.unit}</span>
                {checked && <span className={verdicts[i] ? 'text-ok' : 'text-danger'}>{verdicts[i] ? '✓' : '✗'}</span>}
              </div>
              {checked && i === firstWrong && (
                <div className="mt-2 text-sm" role="status">
                  <p className="font-semibold text-danger">Tady se postup rozchází.</p>
                  <div className="overflow-x-auto"><Tex block tex={`${step.latex} = ${texResult(step.value, step.unit, 2)}`} /></div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {checked && firstWrong === -1 && <p className="mt-3 font-semibold text-ok" role="status">✓ Všechny kroky správně.</p>}
      {checked && firstWrong !== -1 && (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer text-accent">Zobrazit celý postup</summary>
          <Steps steps={task.steps} />
        </details>
      )}
      <div className="mt-4 flex gap-3">
        {!checked && <Button type="submit" disabled={answers.some((a) => a.trim() === '')}>Zkontrolovat</Button>}
        <Button variant="secondary" onClick={reset}>Nové zadání</Button>
      </div>
    </form>
  );
}
