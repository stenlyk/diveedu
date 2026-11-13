import { formatCs } from '@diveedu/calc';
import { Link } from 'react-router';
import { Card, PageHeader } from '../components/ui';
import { conceptsById, content } from '../content';
import { db } from '../db/db';
import { useLiveQuery } from '../db/useLiveQuery';
import { useAnswers, useMastery, useReviewQueue } from '../srs/hooks';
import { dailyStats, type DayStat, type Mastery, streakDays, weakestConcepts } from '../srs/mastery';

export const LEVEL_STYLE: Record<Mastery['level'], { label: string; css: string; mark: string }> = {
  strong: { label: 'zvládnuto', css: 'var(--ok)', mark: '●' },
  medium: { label: 'rozpracováno', css: 'var(--warn)', mark: '◐' },
  weak: { label: 'slabé', css: 'var(--danger)', mark: '○' },
  unknown: { label: 'zatím neznámé', css: 'var(--border)', mark: '·' },
};
const LEVELS = ['strong', 'medium', 'weak', 'unknown'] as const;

/** Sloupcový graf po dnech; výška podle hodnoty, popisek pod grafem. */
function DayBars({ stats, value, max, label }: { stats: DayStat[]; value: (stat: DayStat) => number | null; max: number; label: (v: number) => string }) {
  const width = 100 / stats.length;
  const last = [...stats].reverse().find((stat) => value(stat) !== null);
  return (
    <figure>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label={last ? `Poslední hodnota ${label(value(last)!)}` : 'Zatím žádná data'}>
        <line x1="0" y1="39.5" x2="100" y2="39.5" stroke="var(--border)" strokeWidth="0.5" />
        {stats.map((stat, i) => {
          const v = value(stat);
          if (v === null) return null;
          const height = Math.max(1, (Math.min(v, max) / max) * 38);
          return <rect key={stat.day} x={i * width + width * 0.15} y={39.5 - height} width={width * 0.7} height={height} rx="0.8" fill="var(--accent)"><title>{`${stat.day}: ${label(v)}`}</title></rect>;
        })}
      </svg>
      <figcaption className="flex justify-between text-xs text-muted"><span>před {stats.length} dny</span><span>{last ? `naposledy ${label(value(last)!)}` : 'zatím žádná data'}</span><span>dnes</span></figcaption>
    </figure>
  );
}

export function Dashboard() {
  const answers = useAnswers();
  const mastery = useMastery();
  const queue = useReviewQueue();
  const attempts = useLiveQuery(() => db.examAttempts.orderBy('at').reverse().limit(5).toArray(), []);
  if (!answers || !mastery) return <p className="text-muted">Načítám…</p>;

  const now = Date.now();
  const quiz = answers.filter((a) => a.mode !== 'mental');
  const mental = answers.filter((a) => a.mode === 'mental');
  const quizDays = dailyStats(quiz, now, 14);
  const mentalDays = dailyStats(mental, now, 14);
  const today = dailyStats(answers, now, 1)[0]!;
  const weakest = weakestConcepts([...mastery.keys()].filter((id) => conceptsById.has(id)), mastery, 5).filter((id) => mastery.get(id)!.level !== 'strong');

  return (
    <div>
      <PageHeader title="Přehled" subtitle="Co umíš, co slábne a jak rychle počítáš." />
      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        <Card><div className="text-2xl font-semibold tabular-nums" data-testid="streak">{streakDays(answers.map((a) => a.at), now)}</div><div className="text-sm text-muted">dní v řadě</div></Card>
        <Card><div className="text-2xl font-semibold tabular-nums">{today.total}</div><div className="text-sm text-muted">odpovědí dnes</div></Card>
        <Card><div className="text-2xl font-semibold tabular-nums">{queue ? queue.due.length + queue.fresh.length : 0}</div><div className="text-sm text-muted">karet čeká</div></Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Zvládnutí pojmů</h2>
          <div className="mt-3 space-y-4">
            {content.modules.map((module) => {
              const concepts = content.concepts.filter((c) => c.moduleId === module.id);
              if (concepts.length === 0) return null;
              const counts = Object.fromEntries(LEVELS.map((level) => [level, concepts.filter((c) => (mastery.get(c.id)?.level ?? 'unknown') === level).length])) as Record<Mastery['level'], number>;
              return (
                <div key={module.id}>
                  <div className="mb-1 flex justify-between text-sm"><span>{module.title}</span><span className="text-muted">{counts.strong} / {concepts.length}</span></div>
                  <div className="flex h-3 overflow-hidden rounded-[2px] bg-border" role="img" aria-label={LEVELS.map((level) => `${LEVEL_STYLE[level].label}: ${counts[level]}`).join(', ')}>
                    {LEVELS.map((level) => <span key={level} style={{ width: `${(counts[level] / concepts.length) * 100}%`, background: LEVEL_STYLE[level].css }} />)}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {LEVELS.map((level) => <span key={level}><span style={{ color: LEVEL_STYLE[level].css }}>{LEVEL_STYLE[level].mark}</span> {LEVEL_STYLE[level].label}</span>)}
          </p>
          <Link to="/graf" className="mt-3 inline-block text-sm text-accent underline underline-offset-4">Zobrazit na mapě grafu</Link>
        </Card>

        <Card>
          <h2 className="font-semibold">Co zopakovat</h2>
          {weakest.length === 0 ? <p className="mt-2 text-sm text-muted">Zatím málo odpovědí. Zkus Rychlý check.</p> : (
            <ul className="mt-2 space-y-2">
              {weakest.map((id) => {
                const m = mastery.get(id)!;
                return (
                  <li key={id}>
                    <Link to={`/trenink/tema?pojem=${id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-4 hover:border-accent">
                      <span><span style={{ color: LEVEL_STYLE[m.level].css }}>{LEVEL_STYLE[m.level].mark}</span> {conceptsById.get(id)?.label}</span>
                      <span className="text-sm tabular-nums text-muted">{Math.round(m.score * 100)} % · {m.answers}×</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Úspěšnost za 14 dní</h2>
          <DayBars stats={quizDays} max={100} value={(s) => (s.total ? (s.correct / s.total) * 100 : null)} label={(v) => `${Math.round(v)} %`} />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Rychlost výpočtů z hlavy</h2>
          <DayBars stats={mentalDays} max={60} value={(s) => (s.total ? s.avgSeconds : null)} label={(v) => `${formatCs(v, 1)} s na úlohu`} />
          <p className="mt-1 text-xs text-muted">Nižší sloupec = rychlejší počítání. Celkem {mental.length} úloh, {mental.length ? Math.round((mental.filter((a) => a.correct).length / mental.length) * 100) : 0} % správně.</p>
        </Card>

        {attempts && attempts.length > 0 && (
          <Card className="lg:col-span-2">
            <h2 className="font-semibold">Poslední zkoušky</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {attempts.map((attempt) => (
                <li key={attempt.id} className="flex justify-between gap-3">
                  <span>{content.modules.find((m) => m.id === attempt.moduleId)?.title ?? attempt.moduleId}</span>
                  <span className={`tabular-nums ${attempt.passed ? 'text-ok' : 'text-danger'}`}>{Math.round(attempt.score * 100)} % · {new Date(attempt.at).toLocaleDateString('cs-CZ')}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
