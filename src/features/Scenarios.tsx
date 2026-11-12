import { Link, useParams } from 'react-router';
import { Badge, PageHeader, ReviewBadge } from '../components/ui';
import { content, scenariosById } from '../content';
import { ScenarioPlayer } from '../scenario/ScenarioPlayer';

export function Scenarios() {
  return (
    <div>
      <nav className="text-sm text-muted"><Link to="/trenink" className="underline underline-offset-4">Trénink</Link> › Scénáře</nav>
      <PageHeader title="Rozhodovací scénáře" subtitle="Řešení problémů pod tlakem: čas běží, plyn ubývá a na konci tě čeká rozbor." />
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {content.scenarios.map((scenario) => (
          <li key={scenario.id}>
            <Link to={`/trenink/scenare/${scenario.id}`} className="block h-full rounded-2xl border border-border bg-surface p-4 hover:border-accent">
              <span className="block text-lg font-semibold">{scenario.title}</span>
              <span className="mt-1 block text-sm text-muted">{scenario.summary}</span>
              <span className="mt-2 flex flex-wrap gap-2">
                {scenario.nodes.some((node) => node.darkness === 'black') && <Badge tone="accent">nulová viditelnost</Badge>}
                {scenario.needs_review && <ReviewBadge />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScenarioPage() {
  const { scenarioId = '' } = useParams();
  const scenario = scenariosById.get(scenarioId);
  if (!scenario) return <p>Scénář nenalezen. <Link className="text-accent underline" to="/trenink/scenare">Zpět</Link></p>;
  return (
    <div className="flex flex-1 flex-col">
      <nav className="text-sm text-muted"><Link to="/trenink/scenare" className="underline underline-offset-4">Scénáře</Link> › {scenario.title}</nav>
      <h1 className="mb-3 mt-1 text-2xl font-bold tracking-tight">{scenario.title}</h1>
      <ScenarioPlayer key={scenario.id} scenario={scenario} />
    </div>
  );
}
