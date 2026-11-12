import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Disclaimer } from '../components/Disclaimer';
import { Badge, Card, PageHeader } from '../components/ui';
import { CalcPractice, CalcSolve } from '../tools/CalcView';
import { TissueSimulator } from '../mdx/TissueSimulator';
import { CALC_DEFS, calcDefsById } from '../tools/defs';

export function Tools() {
  const tools = CALC_DEFS.filter((def) => def.tool);
  return (
    <div>
      <PageHeader title="Nástroje" subtitle="Kalkulačky s rozepsaným postupem. Všechny výpočty běží v jednom ověřeném balíčku." />
      <div className="mb-5"><Disclaimer kind="calc" /></div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((def) => (
          <li key={def.id}>
            <Link to={`/nastroje/${def.id}`} className="block h-full min-h-20 rounded-2xl border border-border bg-surface p-4 hover:border-accent">
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold">{def.title}</span>
                {def.steps && <Badge tone="accent">s postupem</Badge>}
              </span>
              <span className="mt-1 block text-sm text-muted">{def.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Simulátory</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <Link to="/nastroje/simulator/tkane" className="block h-full min-h-20 rounded-2xl border border-border bg-surface p-4 hover:border-accent">
            <span className="text-lg font-semibold">Tkáňový simulátor</span>
            <span className="mt-1 block text-sm text-muted">Sycení 16 kompartmentů, M-hodnoty a gradient factors na přehrávaném profilu.</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}

export function SimulatorPage() {
  return (
    <div>
      <nav className="text-sm text-muted"><Link to="/nastroje" className="underline underline-offset-4">Nástroje</Link> › Tkáňový simulátor</nav>
      <h1 className="mb-4 mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tkáňový simulátor</h1>
      <TissueSimulator />
    </div>
  );
}

export function ToolPage() {
  const { toolId = '' } = useParams();
  const def = calcDefsById.get(toolId);
  const [mode, setMode] = useState<'solve' | 'practice'>('solve');
  if (!def) return <p>Kalkulačka nenalezena. <Link className="text-accent underline" to="/nastroje">Zpět</Link></p>;
  return (
    <div>
      <nav className="text-sm text-muted"><Link to="/nastroje" className="underline underline-offset-4">Nástroje</Link> › {def.title}</nav>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{def.title}</h1>
      <p className="mb-4 text-muted">{def.summary}</p>
      <div className="mb-4"><Disclaimer kind="calc" /></div>
      {def.steps && (
        <div className="mb-5 grid max-w-md grid-cols-2 gap-2" role="tablist" aria-label="Režim kalkulačky">
          {([['solve', 'Spočti mi'], ['practice', 'Spočítám sám']] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={`min-h-12 rounded-xl border-2 font-semibold ${mode === value ? 'border-accent bg-accent/15' : 'border-border text-muted'}`}>{label}</button>
          ))}
        </div>
      )}
      <Card>{mode === 'practice' && def.steps ? <CalcPractice key={def.id} def={def} /> : <CalcSolve key={def.id} def={def} />}</Card>
      <p className="mt-4 text-sm text-muted">Režim „Z hlavy na čas“ najdeš v Tréninku (připravuje se).</p>
    </div>
  );
}
