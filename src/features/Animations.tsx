import { Link, useParams } from 'react-router';
import { AnimationPlayer } from '../anim/AnimationPlayer';
import { ANIMATIONS, animationsById } from '../anim/defs';
import { Card, PageHeader } from '../components/ui';
import { lessonsById, modulesById } from '../content';

/** Přehled animovaných výkladů. */
export function Animations() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Animované výklady" subtitle="Krátké namluvené scény k principům, které se lépe ukazují pohybem. Najdeš je i přímo v lekcích." />
      <ul className="space-y-3">
        {ANIMATIONS.map((animation) => (
          <li key={animation.id}>
            <Link to={`/animace/${animation.id}`} className="block rounded-2xl border border-border bg-surface p-4 hover:border-accent">
              <span className="text-lg font-semibold">{animation.title}</span>
              <span className="mt-1 block text-sm text-muted">{modulesById.get(animation.moduleId)?.title} · {animation.cues.length} vět</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnimationPage() {
  const { animationId = '' } = useParams();
  const animation = animationsById.get(animationId);
  if (!animation) return <p>Výklad nenalezen. <Link className="text-accent underline" to="/animace">Zpět</Link></p>;
  const lesson = lessonsById.get(animation.lessonId);
  return (
    <div className="max-w-2xl">
      <nav className="text-sm text-muted"><Link to="/animace" className="underline underline-offset-4">Animované výklady</Link> › {animation.title}</nav>
      <h1 className="mb-3 mt-1 text-2xl font-semibold tracking-tight">{animation.title}</h1>
      <Card><AnimationPlayer key={animation.id} animation={animation} /></Card>
      {lesson && <p className="mt-4 text-sm">Souvislosti a výpočty: <Link to={`/uceni/${lesson.id}`} className="text-accent underline underline-offset-4">lekce {lesson.title}</Link></p>}
    </div>
  );
}
