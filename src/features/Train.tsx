import { useMemo } from 'react';
import { Link } from 'react-router';
import { Badge, Card, LinkButton, PageHeader } from '../components/ui';
import { content } from '../content';
import { QuizRunner, SUPPORTED_TYPES } from '../quiz/QuizRunner';

const MODES = [
  { title: 'Denní opakování', text: 'Rozložené opakování (FSRS) přes všechny odemknuté karty.', time: '5–15 min' },
  { title: 'Z hlavy na čas', text: 'Mentální výpočty MOD, END, ppO2, trimixu a hustoty s rostoucí obtížností.', time: '3–10 min' },
  { title: 'Slabiny', text: 'Automaticky vybrané nejslabší uzly znalostního grafu.', time: '10 min' },
  { title: 'Zkouška modulu', text: 'Simulace teoretické zkoušky: 40–60 otázek, časový limit, práh 80 %.', time: '45–60 min' },
];

export function Train() {
  return (
    <div>
      <PageHeader title="Trénink" subtitle="Za 2 minuty zjistíš, jak na tom jsi. Za 10 minut potrénuješ slabinu." />
      <Card className="mb-6 border-accent/60">
        <h2 className="text-lg font-semibold">Rychlý check</h2>
        <p className="mt-1 text-sm text-muted">10 náhodných otázek napříč vším, co je v aplikaci.</p>
        <LinkButton to="/trenink/rychly-check" className="mt-4 w-full sm:w-auto">Spustit</LinkButton>
      </Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Připravuje se</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {MODES.map((mode) => (
          <Card key={mode.title} className="opacity-80">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{mode.title}</h3>
              <Badge>{mode.time}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{mode.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function sample<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
  return out;
}

export function QuickCheck() {
  // Numerické šablony se mohou opakovat s jinými čísly, dokud není otázek aspoň 10.
  const questions = useMemo(() => {
    const usable = content.questions.filter((question) => SUPPORTED_TYPES.has(question.type));
    const picked = sample(usable, 10);
    const numeric = usable.filter((question) => question.type === 'numeric');
    while (picked.length < 10 && numeric.length > 0) picked.push(numeric[Math.floor(Math.random() * numeric.length)]!);
    return picked;
  }, []);
  return (
    <div>
      <nav className="text-sm text-muted"><Link to="/trenink" className="underline underline-offset-4">Trénink</Link> › Rychlý check</nav>
      <h1 className="mb-4 mt-1 text-2xl font-bold tracking-tight">Rychlý check</h1>
      <QuizRunner questions={questions} mode="quick" />
    </div>
  );
}
