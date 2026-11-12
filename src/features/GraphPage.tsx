import { Link, useParams } from 'react-router';
import { LocalGraph } from '../components/LocalGraph';
import { Card, PageHeader } from '../components/ui';
import { content, conceptsById, lessonsById } from '../content';
import { CONCEPT_TYPE_LABELS, CONCEPT_TYPES } from '../content/schema';

/** Přehled uzlů a lokální okolí. Globální silově rozložená mapa přijde v etapě 3. */
export function GraphPage() {
  const { conceptId } = useParams();
  const concept = conceptId ? conceptsById.get(conceptId) : undefined;

  if (concept) {
    return (
      <div>
        <nav className="text-sm text-muted"><Link to="/graf" className="underline underline-offset-4">Graf</Link> › {concept.label}</nav>
        <h1 className="mb-4 mt-1 text-2xl font-bold tracking-tight">{concept.label}</h1>
        <LocalGraph conceptId={concept.id} />
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

  return (
    <div>
      <PageHeader title="Znalostní graf" subtitle="Pojmy a vazby mezi nimi. Klepni na pojem a uvidíš, co na něj působí a co ovlivňuje." />
      {CONCEPT_TYPES.map((type) => {
        const concepts = content.concepts.filter((item) => item.type === type);
        if (concepts.length === 0) return null;
        return (
          <section key={type} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{CONCEPT_TYPE_LABELS[type]}</h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {concepts.map((item) => (
                <li key={item.id}>
                  <Link to={`/graf/${item.id}`} className="block min-h-14 rounded-xl border border-border bg-surface px-4 py-3 hover:border-accent">
                    <span className="block font-medium">{item.label}</span>
                    <span className="text-sm text-muted">{item.shortDefinition}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
