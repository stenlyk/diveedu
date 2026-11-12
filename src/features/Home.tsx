import { useLiveQuery } from '../db/useLiveQuery';
import { Card, LinkButton, PageHeader } from '../components/ui';
import { content, lessonsById } from '../content';
import { db } from '../db/db';

export function Home() {
  const progress = useLiveQuery(() => db.progress.orderBy('updatedAt').reverse().toArray(), []);
  const answerCount = useLiveQuery(() => db.answers.count(), []);
  const last = progress?.find((row) => row.status === 'started' && lessonsById.has(row.lessonId));
  const lastLesson = last ? lessonsById.get(last.lessonId) : undefined;
  const completed = progress?.filter((row) => row.status === 'completed').length ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="DiveEdu" subtitle="Teorie technického potápění – princip, výpočet, reálný ponor." />
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Card>
          <div className="text-2xl font-bold tabular-nums">{completed} / {content.lessons.length}</div>
          <div className="text-sm text-muted">dokončených lekcí</div>
        </Card>
        <Card>
          <div className="text-2xl font-bold tabular-nums">{answerCount ?? 0}</div>
          <div className="text-sm text-muted">zodpovězených otázek</div>
        </Card>
      </div>
      {/* Primární akce jsou dole, v dosahu palce. */}
      <div className="mt-auto grid grid-cols-1 gap-3 pt-8 sm:max-w-md md:mt-8">
        {lastLesson && <LinkButton variant="secondary" to={`/uceni/${lastLesson.id}`}>Pokračovat: {lastLesson.title}</LinkButton>}
        <LinkButton variant="secondary" to="/uceni">Lekce</LinkButton>
        <LinkButton to="/trenink/rychly-check" className="!min-h-16 text-lg">Rychlý check · 10 otázek</LinkButton>
      </div>
    </div>
  );
}
