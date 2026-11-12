import { Link } from 'react-router';
import { Badge, Card, PageHeader, ReviewBadge } from '../components/ui';
import { content, lessonsOfModule, questionsOfModule } from '../content';
import { db } from '../db/db';
import { useLiveQuery } from '../db/useLiveQuery';

const BRANCH_LABELS = { depth: 'Hlavní linie', cave: 'Jeskynní odbočka', cross: 'Průřezové moduly' } as const;

export function Learn() {
  const progress = useLiveQuery(() => db.progress.toArray(), []);
  const status = new Map(progress?.map((row) => [row.lessonId, row.status]));
  return (
    <div>
      <PageHeader title="Učení" subtitle="Moduly jsou přístupné vždy. Splnit je lze po zkoušce na 80 %." />
      {(['depth', 'cave', 'cross'] as const).map((branch) => {
        const modules = content.modules.filter((module) => module.branch === branch);
        if (modules.length === 0) return null;
        return (
          <section key={branch} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{BRANCH_LABELS[branch]}</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {modules.map((module) => {
                const lessons = lessonsOfModule(module.id);
                return (
                  <Card key={module.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{module.order} · {module.title}</h3>
                      {module.status === 'draft' && <Badge>rozpracováno</Badge>}
                    </div>
                    {module.subtitle && <p className="text-sm text-muted">{module.subtitle}</p>}
                    <p className="mt-1 text-xs text-muted">{lessons.length} lekcí · {questionsOfModule(module.id).length} otázek</p>
                    {lessons.length === 0 ? (
                      <p className="mt-3 text-sm text-muted">Lekce se připravují.</p>
                    ) : (
                      <ol className="mt-3 space-y-2">
                        {lessons.map((lesson) => (
                          <li key={lesson.id}>
                            <Link to={`/uceni/${lesson.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-2 hover:border-accent">
                              <span>
                                <span className="block font-medium">{lesson.title}</span>
                                <span className="text-xs text-muted">{lesson.estimatedMinutes} min</span>
                                {lesson.needs_review && <span className="ml-2"><ReviewBadge /></span>}
                              </span>
                              <span aria-label={status.get(lesson.id) === 'completed' ? 'dokončeno' : status.get(lesson.id) === 'started' ? 'rozpracováno' : 'nezahájeno'} className={status.get(lesson.id) === 'completed' ? 'text-ok' : 'text-muted'}>
                                {status.get(lesson.id) === 'completed' ? '✓' : status.get(lesson.id) === 'started' ? '◐' : '›'}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
      {content.cases.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Ze skutečnosti</h2>
          <Link to="/pripady" className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 hover:border-accent">
            <span><span className="block font-semibold">Případové studie</span><span className="text-sm text-muted">{content.cases.length} rozborů skutečných ponorů a nehod</span></span>
            <span aria-hidden="true" className="text-muted">›</span>
          </Link>
        </section>
      )}
    </div>
  );
}
