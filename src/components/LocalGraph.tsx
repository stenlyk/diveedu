import { Link } from 'react-router';
import { neighbourhood, type Neighbourhood } from '../content';
import { CONCEPT_TYPE_LABELS, RELATION_LABELS } from '../content/schema';

type Side = Neighbourhood['causes'];

function Column({ title, items, arrow }: { title: string; items: Side; arrow: 'in' | 'out' }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      {items.length === 0 && <div className="text-sm text-muted">—</div>}
      <ul className="space-y-2">
        {items.map(({ relation, concept }) => (
          <li key={`${relation.from}-${relation.type}-${relation.to}`} className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-x-2 text-sm">
              {arrow === 'out' && <span className="text-accent">{RELATION_LABELS[relation.type]} →</span>}
              <Link to={`/graf/${concept.id}`} className="font-semibold underline decoration-border underline-offset-4">{concept.label}</Link>
              {arrow === 'in' && <span className="text-accent">→ {RELATION_LABELS[relation.type]}</span>}
            </div>
            <p className="mt-1 text-sm text-muted">{relation.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lokální okolí pojmu: příčiny vlevo (na mobilu nahoře), důsledky vpravo (dole). */
export function LocalGraph({ conceptId }: { conceptId: string }) {
  const data = neighbourhood(conceptId);
  if (!data) return null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start" data-testid="local-graph">
      <Column title="Co na pojem působí" items={data.causes} arrow="in" />
      <div className="rounded-2xl border-2 border-accent bg-accent/10 p-4 text-center md:mt-6 md:max-w-56">
        <div className="text-xs text-muted">{CONCEPT_TYPE_LABELS[data.concept.type]}</div>
        <div className="text-lg font-semibold">{data.concept.label}</div>
        <p className="mt-1 text-sm text-muted">{data.concept.shortDefinition}</p>
      </div>
      <Column title="Na co pojem působí" items={data.effects} arrow="out" />
    </div>
  );
}
