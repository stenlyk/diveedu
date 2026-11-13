import { Badge, Card, Label, LinkButton, PageHeader, Reading, SegmentBar } from '../components/ui';
import { content, lessonsById, modulesById } from '../content';
import { LESSON_SECTIONS } from '../content/schema';
import { db } from '../db/db';
import { useLiveQuery } from '../db/useLiveQuery';
import { useAnswers, useReviewQueue } from '../srs/hooks';
import { streakDays } from '../srs/mastery';

const lineIcon = (path: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
);

/** Úvod: tři údaje z vlastního pokroku a tři akce. Žádná čísla, která aplikace sama nezná. */
export function Home() {
  const progress = useLiveQuery(() => db.progress.orderBy('updatedAt').reverse().toArray(), []);
  const answers = useAnswers();
  const queue = useReviewQueue();
  const last = progress?.find((row) => row.status === 'started' && lessonsById.has(row.lessonId));
  const lastLesson = last ? lessonsById.get(last.lessonId) : undefined;
  const lastModule = lastLesson ? modulesById.get(lastLesson.moduleId) : undefined;
  const completed = progress?.filter((row) => row.status === 'completed').length ?? 0;
  const waiting = queue ? queue.due.length + queue.fresh.length : 0;
  const streak = answers ? streakDays(answers.map((a) => a.at), Date.now()) : 0;
  const returning = (progress?.length ?? 0) > 0 || (answers?.length ?? 0) > 0;

  return (
    <div className="flex min-h-full flex-1 flex-col gap-4">
      <PageHeader title={returning ? 'Vítej zpět' : 'Vítej v DiveEdu'} subtitle="Teorie technického potápění – princip, výpočet, reálný ponor." />

      <div className="-mt-2 grid grid-cols-3 gap-2 sm:max-w-xl">
        <Card className="!p-3"><Label>Série dnů</Label><Reading className="mt-1 block text-xl" value={streak} unit="dní" /></Card>
        <Card className="!p-3"><Label>Lekce</Label><Reading className="mt-1 block text-xl" value={`${completed}/${content.lessons.length}`} /></Card>
        <Card className="!p-3"><Label>Karty čekají</Label><Reading className="mt-1 block text-xl" value={waiting} tone={waiting > 0 ? 'warn' : undefined} /></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-accent">{lineIcon('M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 13V9M9.5 2.5h5')}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">Rychlý check</h2><Badge tone="accent">2 min</Badge></div>
              <p className="text-sm text-muted">10 náhodných otázek napříč vším, na konci mapa slabin.</p>
            </div>
          </div>
          <LinkButton to="/trenink/rychly-check" className="mt-4 w-full !min-h-14 text-base">Rychlý check · 10 otázek</LinkButton>
        </Card>

        {lastLesson && (
          <Card>
            <Label>{lastModule?.title ?? 'Rozpracovaná lekce'}</Label>
            <h2 className="mt-1 text-lg font-semibold">{lastLesson.title}</h2>
            <div className="mt-3 flex items-center justify-between gap-3"><span className="font-mono text-xs uppercase tracking-wider text-accent">Krok {(last?.section ?? 0) + 1} / {LESSON_SECTIONS.length}</span><span className="text-xs text-muted">{lastLesson.estimatedMinutes} min</span></div>
            <div className="mt-2"><SegmentBar total={LESSON_SECTIONS.length} current={last?.section ?? 0} /></div>
            <LinkButton variant="secondary" to={`/uceni/${lastLesson.id}`} className="mt-4 w-full">Pokračovat v lekci →</LinkButton>
          </Card>
        )}

        {waiting > 0 && (
          <Card>
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Dnešní opakování</h2><Badge tone="warn">{waiting} karet</Badge></div>
            <p className="mt-1 text-sm text-muted">Rozložené opakování otázek z lekcí, které jsi otevřel. Otázky ve chvíli, kdy je začínáš zapomínat.</p>
            {queue && (
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-surface-2 p-3"><dt className="label-ui">K opakování</dt><dd><Reading className="text-lg" value={queue.due.length} /></dd></div>
                <div className="rounded-xl border border-border bg-surface-2 p-3"><dt className="label-ui">Nové</dt><dd><Reading className="text-lg" value={queue.fresh.length} /></dd></div>
              </dl>
            )}
            <LinkButton variant="secondary" to="/trenink/opakovani" className="mt-4 w-full">Denní opakování · {waiting}</LinkButton>
          </Card>
        )}
      </div>

      <LinkButton variant="ghost" to="/prehled" className="self-start !px-0">Celý přehled zvládnutí ›</LinkButton>
    </div>
  );
}
