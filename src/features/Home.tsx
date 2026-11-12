import { Card, LinkButton, PageHeader } from '../components/ui';
import { content, lessonsById } from '../content';
import { db } from '../db/db';
import { useLiveQuery } from '../db/useLiveQuery';
import { useAnswers, useReviewQueue } from '../srs/hooks';
import { streakDays } from '../srs/mastery';

export function Home() {
  const progress = useLiveQuery(() => db.progress.orderBy('updatedAt').reverse().toArray(), []);
  const answers = useAnswers();
  const queue = useReviewQueue();
  const last = progress?.find((row) => row.status === 'started' && lessonsById.has(row.lessonId));
  const lastLesson = last ? lessonsById.get(last.lessonId) : undefined;
  const completed = progress?.filter((row) => row.status === 'completed').length ?? 0;
  const waiting = queue ? queue.due.length + queue.fresh.length : 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PageHeader title="DiveEdu" subtitle="Teorie technického potápění – princip, výpočet, reálný ponor." />
      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        <Card><div className="text-2xl font-bold tabular-nums">{answers ? streakDays(answers.map((a) => a.at), Date.now()) : 0}</div><div className="text-sm text-muted">dní v řadě</div></Card>
        <Card><div className="text-2xl font-bold tabular-nums">{completed} / {content.lessons.length}</div><div className="text-sm text-muted">lekcí</div></Card>
        <Card><div className="text-2xl font-bold tabular-nums">{waiting}</div><div className="text-sm text-muted">karet čeká</div></Card>
      </div>
      <LinkButton variant="ghost" to="/prehled" className="mt-2 self-start !px-0">Celý přehled zvládnutí ›</LinkButton>
      {/* Primární akce jsou dole, v dosahu palce. */}
      <div className="mt-auto grid grid-cols-1 gap-3 pt-8 sm:max-w-md md:mt-8">
        {lastLesson && <LinkButton variant="secondary" to={`/uceni/${lastLesson.id}`}>Pokračovat: {lastLesson.title}</LinkButton>}
        {waiting > 0 && <LinkButton variant="secondary" to="/trenink/opakovani">Denní opakování · {waiting}</LinkButton>}
        <LinkButton to="/trenink/rychly-check" className="!min-h-16 text-lg">Rychlý check · 10 otázek</LinkButton>
      </div>
    </div>
  );
}
