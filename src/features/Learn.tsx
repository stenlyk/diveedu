import { Link } from 'react-router';
import { Badge, Card, Label, PageHeader, Reading, ReviewBadge, SegmentBar } from '../components/ui';
import { content, lessonsOfModule, questionsOfModule } from '../content';
import { db } from '../db/db';
import { useLiveQuery } from '../db/useLiveQuery';
import { usePassedModules } from '../srs/hooks';

const BRANCH_LABELS = { depth: 'Hlavní linie', cave: 'Jeskynní odbočka', cross: 'Průřezové moduly' } as const;

export function Learn() {
  const progress = useLiveQuery(() => db.progress.toArray(), []);
  const status = new Map(progress?.map((row) => [row.lessonId, row.status]));
  const passed = usePassedModules();
  const completedCount = progress?.filter((row) => row.status === 'completed').length ?? 0;
  return (
    <div>
      <PageHeader title="Učení" subtitle="Moduly jsou přístupné vždy. Splnit je lze po zkoušce na 80 %." />
      <div className="-mt-1 mb-4 grid grid-cols-2 gap-2 sm:max-w-xl">
        <Link to="/poslech" className="rounded-2xl border border-border bg-surface p-3 hover:border-accent">
          <span className="block font-semibold">🎧 Režim poslechu</span>
          <span className="text-xs text-muted">Shrnutí lekcí do auta</span>
        </Link>
        <Link to="/animace" className="rounded-2xl border border-border bg-surface p-3 hover:border-accent">
          <span className="block font-semibold">▶ Animované výklady</span>
          <span className="text-xs text-muted">Principy v pohybu</span>
        </Link>
      </div>
      <Card className="mb-6 sm:max-w-xl">
        <div className="flex items-baseline justify-between gap-3"><Label>Celkový postup</Label><Reading value={`${completedCount}/${content.lessons.length}`} unit="lekcí" /></div>
        <div className="mt-2 h-1 rounded-[2px] bg-surface-3"><div className="h-1 rounded-[2px] bg-ok" style={{ width: `${(completedCount / Math.max(1, content.lessons.length)) * 100}%` }} /></div>
      </Card>
      {(['depth', 'cave', 'cross'] as const).map((branch) => {
        const modules = content.modules.filter((module) => module.branch === branch);
        if (modules.length === 0) return null;
        return (
          <section key={branch} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><span aria-hidden="true" className="h-4 w-0.5 bg-accent" />{BRANCH_LABELS[branch]}<span className="font-mono text-xs font-normal text-muted">{modules.length} {modules.length === 1 ? 'modul' : modules.length < 5 ? 'moduly' : 'modulů'}</span></h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {modules.map((module) => {
                const lessons = lessonsOfModule(module.id);
                const done = lessons.filter((lesson) => status.get(lesson.id) === 'completed').length;
                return (
                  <Card key={module.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">Modul {String(module.order).padStart(2, '0')}</span>
                      {module.status === 'draft' && <Badge>rozpracováno</Badge>}
                      {passed?.has(module.id) && <Badge tone="ok">✓ splněno</Badge>}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold">{module.title}</h3>
                    {module.subtitle && <p className="text-sm text-muted">{module.subtitle}</p>}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-xs text-muted">
                      <span>{lessons.length} lekcí · {questionsOfModule(module.id).length} otázek</span>
                      {lessons.length > 0 && <span className={done === lessons.length ? 'text-ok' : done > 0 ? 'text-accent' : ''}>{done}/{lessons.length} hotovo</span>}
                    </div>
                    {lessons.length > 0 && <div className="mt-2"><SegmentBar total={lessons.length} current={done === lessons.length ? lessons.length : done} /></div>}
                    {lessons.length === 0 ? (
                      <p className="mt-3 text-sm text-muted">Lekce se připravují.</p>
                    ) : (
                      <ol className="mt-3 space-y-2">
                        {lessons.map((lesson) => (
                          <li key={lesson.id}>
                            <Link to={`/uceni/${lesson.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2 hover:border-accent">
                              <span>
                                <span className="block font-medium">{lesson.title}</span>
                                <span className="font-mono text-xs text-muted">{lesson.estimatedMinutes} min</span>
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
                    {module.status === 'published' && (
                      <Link to={`/trenink/zkouska/${module.id}`} className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent hover:underline">
                        Zkouška modulu{module.prerequisites.some((id) => !passed?.has(id)) ? ' (nejdřív splň předchozí modul)' : ''}
                      </Link>
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
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><span aria-hidden="true" className="h-4 w-0.5 bg-accent" />Ze skutečnosti</h2>
          <Link to="/pripady" className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 hover:border-accent">
            <span><span className="block font-semibold">Případové studie</span><span className="text-sm text-muted">{content.cases.length} rozborů skutečných ponorů a nehod</span></span>
            <span aria-hidden="true" className="text-muted">›</span>
          </Link>
        </section>
      )}
    </div>
  );
}
