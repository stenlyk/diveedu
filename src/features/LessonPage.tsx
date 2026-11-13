import { MDXProvider } from '@mdx-js/react';
import { type ComponentType, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button, ReviewBadge } from '../components/ui';
import { lessonsById, loadLessonBody, modulesById } from '../content';
import { LESSON_SECTIONS, SECTION_TITLES } from '../content/schema';
import { db } from '../db/db';
import { LessonContext, mdxComponents } from '../mdx/components';
import { ReportButton } from './ReportButton';

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const lesson = lessonsById.get(lessonId);
  const [Body, setBody] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;
    setBody(null);
    setFailed(false);
    loadLessonBody(lesson).then((component) => { if (!cancelled) setBody(() => component); }, () => { if (!cancelled) setFailed(true); });
    // Otevřením se lekce označí jako rozpracovaná – tím se její otázky odemknou pro denní opakování.
    void db.progress.get(lesson.id).then((row) => {
      if (!cancelled) setIndex(row && row.status !== 'completed' ? row.section : 0);
      return row ? undefined : db.progress.put({ lessonId: lesson.id, status: 'started', section: 0, updatedAt: Date.now() });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [lesson]);

  if (!lesson) {
    return <p>Lekce nenalezena. <Link className="text-accent underline" to="/uceni">Zpět na přehled</Link></p>;
  }

  const goTo = (next: number) => {
    setIndex(next);
    window.scrollTo({ top: 0 });
    void db.progress.get(lesson.id).then((row) => {
      if (row?.status === 'completed') return undefined;
      return db.progress.put({ lessonId: lesson.id, status: 'started', section: next, updatedAt: Date.now() });
    }).catch(() => undefined);
  };
  const complete = () => void db.progress.put({ lessonId: lesson.id, status: 'completed', section: LESSON_SECTIONS.length - 1, updatedAt: Date.now() }).catch(() => undefined);

  const active = LESSON_SECTIONS[index]!;
  const isLast = index === LESSON_SECTIONS.length - 1;
  const module = modulesById.get(lesson.moduleId);

  return (
    <article className="pb-24 md:pb-0">
      <nav className="label-ui"><Link to="/uceni" className="hover:text-text">Učení</Link> › {module?.title}</nav>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>
      {lesson.needs_review && <div className="mt-2"><ReviewBadge /></div>}

      <ol className="mt-4 flex gap-1" aria-label="Části lekce">
        {LESSON_SECTIONS.map((name, i) => (
          <li key={name} className="flex-1">
            <button type="button" onClick={() => goTo(i)} aria-label={`${i + 1}. ${SECTION_TITLES[name]}`} aria-current={i === index ? 'step' : undefined} className="block h-11 w-full">
              <span className={`block h-1 rounded-[2px] ${i === index ? 'bg-accent' : i < index ? 'bg-ok' : 'bg-surface-3'}`} />
            </button>
          </li>
        ))}
      </ol>
      <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-accent">{index + 1} / {LESSON_SECTIONS.length} · {SECTION_TITLES[active]}</h2>

      <div className="mt-4 min-h-[40dvh]">
        {failed && <p className="text-danger">Lekci se nepodařilo načíst.</p>}
        {!Body && !failed && <p className="text-muted">Načítám…</p>}
        {Body && (
          <LessonContext.Provider value={{ lesson, active }}>
            <MDXProvider components={mdxComponents}><Body /></MDXProvider>
          </LessonContext.Provider>
        )}
        {isLast && (
          <footer className="mt-8 max-w-[68ch] border-t border-border pt-4 text-sm text-muted">
            <h3 className="font-semibold text-text">Zdroje</h3>
            <ul className="mt-1 list-disc pl-5">
              {lesson.sources.map((source) => <li key={source.title}>{[source.author, source.title, source.year].filter(Boolean).join(', ')}</li>)}
            </ul>
            <div className="mt-4"><ReportButton kind="lesson" targetId={lesson.id} /></div>
          </footer>
        )}
      </div>

      {/* Na mobilu přilepeno nad spodní navigací, v dosahu palce. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex gap-3 border-t border-border bg-surface px-4 py-3 md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
        <Button variant="secondary" className="flex-1 md:flex-none" disabled={index === 0} onClick={() => goTo(index - 1)}>Zpět</Button>
        {isLast ? (
          <Link to="/uceni" onClick={complete} className="inline-flex min-h-12 flex-[2] items-center justify-center rounded-xl bg-accent px-5 font-semibold text-accent-ink md:flex-none">Dokončit lekci</Link>
        ) : (
          <Button className="flex-[2] md:flex-none" onClick={() => goTo(index + 1)}>Dál: {SECTION_TITLES[LESSON_SECTIONS[index + 1]!]}</Button>
        )}
      </div>
    </article>
  );
}
