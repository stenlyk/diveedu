import * as calc from '@diveedu/calc';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Disclaimer } from '../components/Disclaimer';
import { Badge, Button, Card, PageHeader, ReviewBadge } from '../components/ui';
import { casesById, conceptsById, content } from '../content';
import { callContentFunction } from '../content/fns';
import type { CaseStudy } from '../content/schema';
import { ReportButton } from './ReportButton';

const LAYERS: Record<CaseStudy['errorChain'][number]['layer'], string> = {
  planovani: 'Plánování',
  plyn: 'Plyn',
  vybaveni: 'Vybavení',
  prostredi: 'Prostředí',
  'lidsky-faktor': 'Lidský faktor',
};

export function Cases() {
  return (
    <div>
      <PageHeader title="Případové studie" subtitle="Skutečné ponory a nehody. Učíme se z rozhodnutí, ne z lidí." />
      <div className="mb-5"><Disclaimer kind="case" /></div>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {content.cases.map((study) => (
          <li key={study.id}>
            <Link to={`/pripady/${study.id}`} className="block h-full rounded-2xl border border-border bg-surface p-4 hover:border-accent">
              <span className="block text-lg font-semibold">{study.title}</span>
              <span className="text-sm text-muted">{[study.location, study.year].filter(Boolean).join(' · ')}</span>
              <span className="mt-2 flex flex-wrap gap-2">
                <Badge tone={study.certainty === 'doloženo' ? 'ok' : 'warn'}>{study.certainty}</Badge>
                {study.anonymized && <Badge>anonymizovaný vzorec</Badge>}
                {study.needs_review && <ReviewBadge />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Profile({ profile }: { profile: CaseStudy['profile'] }) {
  if (profile.length < 2) return <p className="text-sm text-muted">Spolehlivá data o profilu ponoru nejsou veřejně k dispozici.</p>;
  const maxT = Math.max(...profile.map((p) => p.minute));
  const maxD = Math.max(...profile.map((p) => p.depthM));
  const x = (minute: number) => 40 + (minute / maxT) * 340;
  const y = (depthM: number) => 15 + (depthM / maxD) * 150;
  return (
    <svg viewBox="0 0 400 190" role="img" aria-label="Profil ponoru: hloubka v čase" className="w-full max-w-xl">
      <line x1="40" y1="15" x2="380" y2="15" stroke="var(--accent)" strokeDasharray="5 4" />
      <polyline fill="none" stroke="var(--text)" strokeWidth="2" points={profile.map((p) => `${x(p.minute)},${y(p.depthM)}`).join(' ')} />
      {profile.filter((p) => p.event).map((p) => (
        <g key={p.minute}>
          <circle cx={x(p.minute)} cy={y(p.depthM)} r="4" fill="var(--warn)" />
          <text x={x(p.minute) + 6} y={y(p.depthM) - 6} fontSize="10" fill="var(--muted)">{p.event}</text>
        </g>
      ))}
      <text x="4" y="19" fontSize="10" fill="var(--muted)">0 m</text>
      <text x="4" y="168" fontSize="10" fill="var(--muted)">{maxD} m</text>
      <text x="380" y="185" fontSize="10" textAnchor="end" fill="var(--muted)">{maxT} min</text>
    </svg>
  );
}

function CalcTask({ task }: { task: CaseStudy['calcTasks'][number] }) {
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);
  const answer = callContentFunction(task.fn, task.args) as number;
  const value = calc.parseCs(input);
  const correct = value !== null && Math.abs(value - answer) <= task.tolerance + 1e-9;
  return (
    <form className="rounded-xl bg-surface-2 p-3" onSubmit={(event) => { event.preventDefault(); setChecked(true); }}>
      <p className="font-medium">{task.prompt}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input inputMode="decimal" autoComplete="off" aria-label={`Výsledek v ${task.unit}`} value={input} disabled={checked} onChange={(event) => setInput(event.target.value)} className="min-h-12 w-32 rounded-xl border-2 border-border bg-bg px-3 text-lg tabular-nums" />
        <span className="text-muted">{task.unit}</span>
        {!checked && <Button type="submit" disabled={input.trim() === ''}>Ověřit</Button>}
      </div>
      {checked && (
        <p className={`mt-2 text-sm ${correct ? 'text-ok' : 'text-danger'}`} role="status">
          {correct ? '✓ Správně.' : '✗ Vedle.'} Výsledek: <strong className="tabular-nums">{calc.formatCs(answer, task.tolerance < 0.1 ? 2 : 1)} {task.unit}</strong>
        </p>
      )}
    </form>
  );
}

export function CasePage() {
  const { caseId = '' } = useParams();
  const study = casesById.get(caseId);
  if (!study) return <p>Případová studie nenalezena. <Link className="text-accent underline" to="/pripady">Zpět</Link></p>;
  const heading = 'mt-7 mb-2 text-lg font-semibold';
  return (
    <article className="max-w-3xl">
      <nav className="text-sm text-muted"><Link to="/pripady" className="underline underline-offset-4">Případové studie</Link></nav>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{study.title}</h1>
      <p className="text-muted">{[study.location, study.year].filter(Boolean).join(' · ')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge tone={study.certainty === 'doloženo' ? 'ok' : 'warn'}>Příčina: {study.certainty}</Badge>
        {study.anonymized && <Badge>anonymizovaný vzorec, ne konkrétní nehoda</Badge>}
        {study.needs_review && <ReviewBadge />}
      </div>
      <div className="mt-4"><Disclaimer kind="case" /></div>

      <h2 className={heading}>1. Kontext</h2>
      <p>{study.context}</p>

      <h2 className={heading}>2. Profil</h2>
      <Profile profile={study.profile} />

      <h2 className={heading}>3. Časová osa</h2>
      <ol className="space-y-2">
        {study.timeline.map((item) => (
          <li key={item.when + item.what} className="grid grid-cols-[6.5rem_1fr] gap-3"><span className="text-sm font-semibold text-accent">{item.when}</span><span>{item.what}</span></li>
        ))}
      </ol>

      <h2 className={heading}>4. Řetěz chyb</h2>
      <p className="mb-3 text-sm text-muted">Model švýcarského sýra: nehoda projde, až když se otvory ve všech vrstvách obrany seřadí za sebe.</p>
      <ol className="space-y-2">
        {study.errorChain.map((link, i) => (
          <li key={i} className="rounded-xl border border-border bg-surface p-3">
            <Badge tone="accent">{LAYERS[link.layer]}</Badge>
            <p className="mt-1">{link.description}</p>
            {link.conceptIds.length > 0 && (
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
                {link.conceptIds.map((id) => <Link key={id} to={`/graf/${id}`} className="text-accent underline underline-offset-4">{conceptsById.get(id)?.label ?? id}</Link>)}
              </p>
            )}
          </li>
        ))}
      </ol>

      <Link to={`/graf?zvyraznit=${[...new Set(study.errorChain.flatMap((link) => link.conceptIds))].join(',')}`} className="mt-3 inline-flex min-h-11 items-center text-accent underline underline-offset-4">Zobrazit řetěz v mapě grafu</Link>

      <h2 className={heading}>5. Fyziologický mechanismus</h2>
      <p>{study.physiology}</p>

      {study.calcTasks.length > 0 && (
        <>
          <h2 className={heading}>6. Spočítej si to</h2>
          <div className="mb-3"><Disclaimer kind="calc" /></div>
          <div className="space-y-3">{study.calcTasks.map((task) => <CalcTask key={task.prompt} task={task} />)}</div>
        </>
      )}

      <h2 className={heading}>7. Co by řetěz přerušilo</h2>
      <ul className="list-disc space-y-1 pl-5">{study.preventions.map((item) => <li key={item}>{item}</li>)}</ul>

      <h2 className={heading}>8. Zdroje</h2>
      <Card>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {study.sources.map((source) => <li key={source.title}>{[source.author, source.title, source.year].filter(Boolean).join(', ')}{source.note ? ` – ${source.note}` : ''}</li>)}
        </ul>
        <div className="mt-3"><ReportButton kind="case" targetId={study.id} /></div>
      </Card>
    </article>
  );
}
