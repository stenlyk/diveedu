import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { LocalGraph } from '../components/LocalGraph';
import { Badge, Card, LinkButton, PageHeader } from '../components/ui';
import { content, conceptsById, lessonsById } from '../content';
import { CONCEPT_TYPE_LABELS, CONCEPT_TYPES, RELATION_LABELS, RELATION_TYPES } from '../content/schema';
import { useMastery } from '../srs/hooks';
import { LEVEL_STYLE } from './Dashboard';

// Mapa (d3) se načítá, až když je potřeba.
const GraphMap = lazy(() => import('../components/GraphMap').then((m) => ({ default: m.GraphMap })));

function ConceptDetail({ conceptId }: { conceptId: string }) {
  const concept = conceptsById.get(conceptId)!;
  const mastery = useMastery();
  const m = mastery?.get(concept.id);
  const level = m?.level ?? 'unknown';
  return (
    <div>
      <nav className="text-sm text-muted"><Link to="/graf" className="underline underline-offset-4">Graf</Link> › {concept.label}</nav>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{concept.label}</h1>
      <p className="mb-4 mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span><span style={{ color: LEVEL_STYLE[level].css }}>{LEVEL_STYLE[level].mark}</span> {LEVEL_STYLE[level].label}{m ? ` · ${Math.round(m.score * 100)} % z ${m.answers} odpovědí` : ''}</span>
      </p>
      <LocalGraph conceptId={concept.id} />
      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton to={`/trenink/tema?pojem=${concept.id}`}>Trénovat tento pojem</LinkButton>
      </div>
      {concept.lessonIds.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-semibold">Lekce k pojmu</h2>
          <ul className="mt-2 space-y-1">
            {concept.lessonIds.map((id) => (
              <li key={id}><Link className="text-accent underline underline-offset-4" to={`/uceni/${id}`}>{lessonsById.get(id)?.title ?? id}</Link></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const chip = (active: boolean) => `min-h-11 rounded-full border px-4 text-sm ${active ? 'border-accent bg-accent/15 text-text' : 'border-border text-muted'}`;

export function GraphPage() {
  const { conceptId } = useParams();
  const [params, setParams] = useSearchParams();
  const mastery = useMastery();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [moduleId, setModuleId] = useState<string>('all');
  const [relationType, setRelationType] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string>();

  const highlight = useMemo(() => (params.get('zvyraznit') ?? '').split(',').filter((id) => conceptsById.has(id)), [params]);
  const concepts = useMemo(() => content.concepts.filter((c) => moduleId === 'all' || c.moduleId === moduleId || highlight.includes(c.id)), [moduleId, highlight]);
  const relations = useMemo(() => content.relations.filter((r) => relationType === 'all' || r.type === relationType), [relationType]);

  if (conceptId && conceptsById.has(conceptId)) return <ConceptDetail conceptId={conceptId} />;
  const selected = selectedId ? conceptsById.get(selectedId) : undefined;

  return (
    <div>
      <PageHeader title="Znalostní graf" subtitle="Pojmy a vazby mezi nimi. Barva ukazuje, jak který pojem zvládáš." />
      <div className="mb-3 grid max-w-xs grid-cols-2 gap-2" role="tablist" aria-label="Zobrazení grafu">
        {([['map', 'Mapa'], ['list', 'Seznam']] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} className={`min-h-11 rounded-xl border-2 font-semibold ${view === value ? 'border-accent bg-accent/15' : 'border-border text-muted'}`}>{label}</button>
        ))}
      </div>

      {view === 'map' ? (
        <>
          {highlight.length > 0 && (
            <p className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-accent/60 bg-accent/10 px-4 py-2 text-sm">
              Zvýrazněný řetěz příčin: {highlight.map((id) => conceptsById.get(id)?.label).join(' · ')}
              <button type="button" className="min-h-11 text-accent underline underline-offset-4" onClick={() => setParams({})}>Zrušit zvýraznění</button>
            </p>
          )}
          <div className="mb-2 flex flex-wrap gap-2" aria-label="Filtr podle modulu">
            <button type="button" aria-pressed={moduleId === 'all'} className={chip(moduleId === 'all')} onClick={() => setModuleId('all')}>Vše</button>
            {content.modules.map((module) => <button key={module.id} type="button" aria-pressed={moduleId === module.id} className={chip(moduleId === module.id)} onClick={() => setModuleId(module.id)}>{module.title}</button>)}
          </div>
          <label className="mb-3 flex items-center gap-2 text-sm text-muted">
            Vazby:
            <select value={relationType} onChange={(event) => setRelationType(event.target.value)} className="min-h-11 rounded-xl border border-border bg-surface px-3 text-text">
              <option value="all">všechny typy</option>
              {RELATION_TYPES.map((type) => <option key={type} value={type}>{RELATION_LABELS[type]}</option>)}
            </select>
          </label>
          <Suspense fallback={<p className="text-muted">Načítám mapu…</p>}>
            <GraphMap concepts={concepts} relations={relations} mastery={mastery} highlight={highlight} selectedId={selectedId} onSelect={setSelectedId} />
          </Suspense>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {(['strong', 'medium', 'weak', 'unknown'] as const).map((level) => <span key={level}><span style={{ color: LEVEL_STYLE[level].css }}>{LEVEL_STYLE[level].mark}</span> {LEVEL_STYLE[level].label}</span>)}
            <span>Táhni pro posun, přibliž tlačítky, dvěma prsty nebo kolečkem.</span>
          </p>
          {selected && (
            <Card className="mt-3" >
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold" data-testid="graph-selected">{selected.label}</h2><Badge>{CONCEPT_TYPE_LABELS[selected.type]}</Badge></div>
              <p className="mt-1 text-sm text-muted">{selected.shortDefinition}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <LinkButton to={`/graf/${selected.id}`}>Příčiny a důsledky</LinkButton>
                <LinkButton variant="secondary" to={`/trenink/tema?pojem=${selected.id}`}>Trénovat</LinkButton>
              </div>
            </Card>
          )}
        </>
      ) : (
        CONCEPT_TYPES.map((type) => {
          const list = content.concepts.filter((item) => item.type === type);
          if (list.length === 0) return null;
          return (
            <section key={type} className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{CONCEPT_TYPE_LABELS[type]}</h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((item) => {
                  const level = mastery?.get(item.id)?.level ?? 'unknown';
                  return (
                    <li key={item.id}>
                      <Link to={`/graf/${item.id}`} className="block min-h-14 rounded-xl border border-border bg-surface px-4 py-3 hover:border-accent">
                        <span className="block font-medium"><span style={{ color: LEVEL_STYLE[level].css }} title={LEVEL_STYLE[level].label}>{LEVEL_STYLE[level].mark}</span> {item.label}</span>
                        <span className="text-sm text-muted">{item.shortDefinition}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
