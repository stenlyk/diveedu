import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Badge, Button, Card, LinkButton, PageHeader } from '../components/ui';
import { conceptsById, content, modulesById, questionsOfModule } from '../content';
import type { Question } from '../content/schema';
import { db } from '../db/db';
import { QuizRunner, type QuizResult, SUPPORTED_TYPES, WrongList } from '../quiz/QuizRunner';
import { useMastery, usePassedModules, useReviewQueue } from '../srs/hooks';
import { pickExamQuestions, weakestConcepts } from '../srs/mastery';

function sample<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
  return out;
}

function Crumb({ title }: { title: string }) {
  return (
    <>
      <nav className="text-sm text-muted"><Link to="/trenink" className="underline underline-offset-4">Trénink</Link> › {title}</nav>
      <h1 className="mb-4 mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
    </>
  );
}

function ModeCard({ to, title, text, time, badge }: { to: string; title: string; text: string; time: string; badge?: string }) {
  return (
    <Link to={to} className="block h-full rounded-2xl border border-border bg-surface p-4 hover:border-accent">
      <span className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold">{title}</span>
        <span className="flex gap-2">{badge && <Badge tone="accent">{badge}</Badge>}<Badge>{time}</Badge></span>
      </span>
      <span className="mt-1 block text-sm text-muted">{text}</span>
    </Link>
  );
}

export function Train() {
  const queue = useReviewQueue();
  const passed = usePassedModules();
  const waiting = queue ? queue.due.length + queue.fresh.length : 0;
  return (
    <div>
      <PageHeader title="Trénink" subtitle="Za 2 minuty zjistíš, jak na tom jsi. Za 10 minut potrénuješ slabinu." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ModeCard to="/trenink/opakovani" title="Denní opakování" time="5–15 min" badge={waiting > 0 ? `${waiting} čeká` : undefined} text="Rozložené opakování: otázky se vracejí právě ve chvíli, kdy bys je začal zapomínat." />
        <ModeCard to="/trenink/rychly-check" title="Rychlý check" time="2 min" text="10 náhodných otázek napříč vším a přehled, co zopakovat." />
        <ModeCard to="/trenink/z-hlavy" title="Z hlavy na čas" time="3–10 min" text="Mentální výpočty MOD, ppO2, EAD, END a hustoty s rostoucí obtížností a tipy na odhady." />
        <ModeCard to="/trenink/slabiny" title="Slabiny" time="10 min" text="Otázky z pojmů, které ti jdou nejhůř." />
        {content.scenarios.length > 0 && <ModeCard to="/trenink/scenare" title="Scénáře" time="5 min" text="Větvené situace s časovým limitem a ubývajícím plynem, včetně nulové viditelnosti." />}
        <ModeCard to="/trenink/tema" title="Trénink tématu" time="volitelná" text="Otázky z vybraného modulu nebo jednoho pojmu grafu." />
      </div>
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Zkouška modulu</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {content.modules.filter((module) => module.status === 'published').map((module) => (
          <ModeCard key={module.id} to={`/trenink/zkouska/${module.id}`} title={module.title} time="45 min" badge={passed?.has(module.id) ? '✓ splněno' : undefined} text={`Simulace teoretické zkoušky bez nápovědy. Práh ${Math.round(module.passThreshold * 100)} %.`} />
        ))}
      </div>
    </div>
  );
}

export function QuickCheck() {
  const questions = useMemo(() => sample(content.questions.filter((q) => SUPPORTED_TYPES.has(q.type)), 10), []);
  return (
    <div>
      <Crumb title="Rychlý check" />
      <QuizRunner questions={questions} mode="quick" />
    </div>
  );
}

export function Review() {
  const queue = useReviewQueue();
  // Fronta se sestaví jednou při otevření; během opakování se nemění pod rukama.
  const [frozen, setFrozen] = useState<Question[] | null>(null);
  if (queue && frozen === null) setFrozen([...queue.due, ...queue.fresh]);
  return (
    <div>
      <Crumb title="Denní opakování" />
      {frozen === null ? (
        <p className="text-muted">Načítám…</p>
      ) : frozen.length === 0 ? (
        <Card>
          <p className="font-semibold">Dnes není co opakovat.</p>
          <p className="mt-1 text-sm text-muted">Nové karty se odemykají otevřením lekce. Naplánované karty se vrátí, až přijde jejich čas.</p>
          <div className="mt-4 flex flex-wrap gap-3"><LinkButton to="/uceni">Lekce</LinkButton><LinkButton variant="secondary" to="/trenink/rychly-check">Rychlý check</LinkButton></div>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{queue?.due.length ?? 0} karet po termínu, nových nejvýš 10 denně. Po správné odpovědi můžeš označit, že to bylo těžké – karta se vrátí dřív.</p>
          <QuizRunner questions={frozen} mode="review" />
        </>
      )}
    </div>
  );
}

export function Weaknesses() {
  const mastery = useMastery();
  const [frozen, setFrozen] = useState<{ concepts: string[]; questions: Question[] } | null>(null);
  if (mastery && frozen === null) {
    const concepts = weakestConcepts(content.concepts.map((c) => c.id), mastery, 5);
    const pool = content.questions.filter((q) => SUPPORTED_TYPES.has(q.type) && q.conceptIds.some((id) => concepts.includes(id)));
    setFrozen({ concepts, questions: sample(pool, 10) });
  }
  return (
    <div>
      <Crumb title="Slabiny" />
      {frozen === null ? <p className="text-muted">Načítám…</p> : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            Nejslabší pojmy:
            {frozen.concepts.map((id) => <Link key={id} to={`/graf/${id}`} className="rounded border border-border px-3 py-1 text-text">{conceptsById.get(id)?.label}</Link>)}
          </p>
          <QuizRunner questions={frozen.questions} mode="training" />
        </>
      )}
    </div>
  );
}

export function Topic() {
  const [params, setParams] = useSearchParams();
  const moduleId = params.get('modul');
  const conceptId = params.get('pojem');
  const questions = useMemo(() => {
    const pool = conceptId
      ? content.questions.filter((q) => q.conceptIds.includes(conceptId))
      : moduleId ? questionsOfModule(moduleId) : [];
    return sample(pool.filter((q) => SUPPORTED_TYPES.has(q.type)), 15);
  }, [moduleId, conceptId]);
  const title = conceptId ? conceptsById.get(conceptId)?.label : moduleId ? modulesById.get(moduleId)?.title : undefined;

  if (!title) {
    return (
      <div>
        <Crumb title="Trénink tématu" />
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Modul</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {content.modules.map((module) => (
            <Button key={module.id} variant="secondary" className="justify-start" onClick={() => setParams({ modul: module.id })}>{module.title}</Button>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">Jeden konkrétní pojem si vybereš v <Link to="/graf" className="text-accent underline underline-offset-4">Grafu</Link> – u každého je tlačítko Trénovat.</p>
      </div>
    );
  }
  return (
    <div>
      <Crumb title={`Trénink: ${title}`} />
      <QuizRunner key={`${moduleId}-${conceptId}`} questions={questions} mode="training" />
    </div>
  );
}

const EXAM_QUESTIONS = 40;
const EXAM_MINUTES = 45;

export function Exam() {
  const { moduleId = '' } = useParams();
  const module = modulesById.get(moduleId);
  const [run, setRun] = useState<{ questions: Question[]; startedAt: number; deadline: number } | null>(null);

  if (!module) return <p>Modul nenalezen. <Link className="text-accent underline" to="/trenink">Zpět</Link></p>;
  const pool = questionsOfModule(module.id).filter((q) => SUPPORTED_TYPES.has(q.type));
  const conceptIds = content.concepts.filter((c) => c.moduleId === module.id).map((c) => c.id);
  const count = Math.min(EXAM_QUESTIONS, pool.length);
  const threshold = Math.round(module.passThreshold * 100);

  const start = () => {
    const startedAt = Date.now();
    setRun({ questions: pickExamQuestions(pool, conceptIds, count), startedAt, deadline: startedAt + EXAM_MINUTES * 60_000 });
  };
  const save = (result: QuizResult) => {
    if (!run) return;
    const score = result.correct / result.total;
    void db.examAttempts.add({ moduleId: module.id, at: Date.now(), score, passed: score >= module.passThreshold - 1e-9, durationMs: Date.now() - run.startedAt }).catch(() => undefined);
  };

  if (!run) {
    return (
      <div>
        <Crumb title={`Zkouška: ${module.title}`} />
        <Card>
          <ul className="list-disc space-y-1 pl-5">
            <li>{count} otázek pokrývajících všechny pojmy modulu</li>
            <li>časový limit {EXAM_MINUTES} minut</li>
            <li>bez vysvětlení v průběhu; rozbor dostaneš na konci</li>
            <li>ke splnění je potřeba {threshold} %</li>
          </ul>
          <Button className="mt-5 w-full sm:w-auto" onClick={start}>Začít zkoušku</Button>
        </Card>
      </div>
    );
  }
  return (
    <div>
      <Crumb title={`Zkouška: ${module.title}`} />
      <QuizRunner
        key={run.startedAt}
        questions={run.questions}
        mode="exam"
        feedback={false}
        deadline={run.deadline}
        onFinish={save}
        renderResult={(result) => {
          const percent = Math.round((result.correct / result.total) * 100);
          const passed = result.correct / result.total >= module.passThreshold - 1e-9;
          const missed = new Map<string, number>();
          for (const q of [...result.outcomes.filter((o) => !o.correct).map((o) => o.question), ...result.unanswered]) {
            for (const id of q.conceptIds) missed.set(id, (missed.get(id) ?? 0) + 1);
          }
          const worst = [...missed].sort((a, b) => b[1] - a[1]).slice(0, 6);
          return (
            <Card>
              <div className="text-sm text-muted">Výsledek zkoušky</div>
              <div className={`text-4xl font-semibold ${passed ? 'text-ok' : 'text-danger'}`} data-testid="exam-score">{percent} %</div>
              <p className="mt-1 font-semibold">{passed ? '✓ Splněno' : `✗ Nesplněno – potřeba ${threshold} %`}</p>
              <p className="text-sm text-muted">{result.correct} z {result.total} správně{result.unanswered.length > 0 ? `, ${result.unanswered.length} nezodpovězeno (vypršel čas)` : ''}.</p>
              {worst.length > 0 && (
                <>
                  <h2 className="mt-4 font-semibold">Kde jsi ztratil nejvíc</h2>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {worst.map(([id, n]) => <li key={id}><Link to={`/trenink/tema?pojem=${id}`} className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm hover:border-accent">{conceptsById.get(id)?.label} · {n}×</Link></li>)}
                  </ul>
                </>
              )}
              <WrongList result={result} />
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setRun(null)}>Nový pokus</Button>
                <LinkButton variant="ghost" to="/uceni">Zpět na lekce</LinkButton>
              </div>
            </Card>
          );
        }}
      />
    </div>
  );
}
