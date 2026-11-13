import { formatCs } from '@diveedu/calc';
import { useState } from 'react';
import { type FeltLine, feel, hasLine, move, navDebrief, neighbors, nodeOf, placeCookie, startNav, TRAINING_CAVE, turn, turnBar } from '../cave/nav';
import { Disclaimer } from '../components/Disclaimer';
import { Badge, Button } from '../components/ui';

const MAP = TRAINING_CAVE;
const OUTCOME = { success: { title: 'Čistý ponor', css: 'border-ok' }, partial: { title: 'Venku, ale s výhradami', css: 'border-warn' }, fail: { title: 'Nezvládnuto', css: 'border-danger' } } as const;
const TONE = { info: 'text-muted', good: 'text-ok', bad: 'text-danger' } as const;

/** Pořadí šňůr při hmatu: pootočené podle uzlu, aby cesta ven nebyla vždy na stejném místě. */
function rotate<T>(items: T[], seed: string): T[] {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return items.map((_, k) => items[(k + hash) % items.length]!);
}

function feltLabel(line: FeltLine): string {
  if (line.blind) return 'Pustit šňůru a plavat naslepo';
  const base = line.jump ? 'Tvoje skoková šňůra' : 'Šňůra';
  const marks = [
    line.back ? 'po ní jsi právě připlaval' : null,
    line.cookie ? 'je na ní tvoje značka' : null,
    line.arrow === 'away' ? 'šipka ukazuje tímto směrem' : line.arrow === 'toward' ? 'šipka ukazuje proti tobě' : null,
  ].filter(Boolean);
  return marks.length ? `${base}: ${marks.join(', ')}` : `${base} bez značek`;
}

/**
 * Jeskynní navigační mapa: cesta dovnitř s hlídáním tlaku otočky, skoky a značky, návrat po hmatu v nulové viditelnosti.
 * Ovládá se velkými tlačítky dole; mapa je jen k dívání.
 */
export function CaveNavigator() {
  const [zeroVis, setZeroVis] = useState(true);
  const [state, setState] = useState(() => startNav(MAP, true));
  const restart = (zero = zeroVis) => setState(startNav(MAP, zero));
  const dark = state.phase === 'out' && state.zeroVisibility;
  const untouched = state.phase === 'in' && state.from === null && state.minutes === 0;
  const limit = turnBar(MAP);
  const low = state.gasBar < limit;
  const pos = nodeOf(MAP, state.at);
  const canMark = state.phase === 'in' && !!state.from && state.cookiesLeft > 0 && !state.cookies.includes(`${state.at}>${state.from}`);

  return (
    <div className="space-y-4" data-testid="cave-nav" data-phase={state.phase}>
      <Disclaimer kind="calc" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums">
        <span className={`text-lg font-semibold ${low ? 'text-danger' : ''}`} data-testid="cave-gas">{formatCs(state.gasBar, 0)} bar</span>
        <span className="text-muted">otočka {limit} bar</span>
        <span className="text-muted">{formatCs(state.minutes, 0)} min</span>
        <span className="text-muted">značky {state.cookiesLeft} · cívky {state.spoolsLeft}</span>
      </div>

      {dark ? (
        <div className="rounded-2xl bg-black p-5 text-neutral-300" data-testid="cave-dark">
          <Badge tone="warn">nulová viditelnost</Badge>
          <p className="mt-3 text-lg leading-relaxed">Nevidíš nic. Jedna ruka je na šňůře. Tady nahmatáš:</p>
        </div>
      ) : (
        <svg viewBox="0 0 320 180" role="img" aria-label={`Mapa jeskyně. Jsi v bodě ${pos.label}.`} className="w-full rounded-2xl bg-surface-2">
          {MAP.edges.map((edge) => {
            const a = nodeOf(MAP, edge.a);
            const b = nodeOf(MAP, edge.b);
            const jumped = edge.line === 'none' && hasLine(MAP, state, edge.a, edge.b);
            const stroke = edge.line === 'main' ? 'var(--warn)' : edge.line === 'side' ? 'var(--text)' : jumped ? 'var(--accent)' : 'var(--muted)';
            const tip = edge.arrowTo ? nodeOf(MAP, edge.arrowTo) : null;
            const tail = tip ? (tip.id === a.id ? b : a) : null;
            const angle = tip && tail ? (Math.atan2(tip.y - tail.y, tip.x - tail.x) * 180) / Math.PI : 0;
            return (
              <g key={`${edge.a}-${edge.b}`}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={edge.line === 'main' ? 3 : 2} strokeDasharray={edge.line === 'none' ? (jumped ? '5 3' : '2 5') : undefined} strokeOpacity={edge.line === 'none' && !jumped ? 0.5 : 1} />
                {tip && <polygon points="5,0 -4,-4 -4,4" fill="var(--warn)" transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2}) rotate(${angle})`} />}
              </g>
            );
          })}
          {state.cookies.map((mark) => {
            const [nodeId, toward] = mark.split('>') as [string, string];
            const n = nodeOf(MAP, nodeId);
            const t = nodeOf(MAP, toward);
            const length = Math.hypot(t.x - n.x, t.y - n.y);
            return <circle key={mark} cx={n.x + ((t.x - n.x) / length) * 12} cy={n.y + ((t.y - n.y) / length) * 12} r="4" fill="var(--accent)" stroke="var(--bg)" strokeWidth="1.5" />;
          })}
          {MAP.nodes.map((node) => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={node.kind === 'entrance' || node.kind === 'other-exit' ? 6 : 4} fill={node.kind === 'entrance' ? 'var(--ok)' : node.kind === 'other-exit' ? 'var(--muted)' : 'var(--surface)'} stroke="var(--text)" strokeWidth="1.5" />
              <text x={node.x} y={node.y + (node.y < 40 || node.id === 'c' || node.id === 's' ? -9 : 17)} textAnchor="middle" fontSize="8.5" fill="var(--muted)">{node.label}</text>
            </g>
          ))}
          <circle cx={pos.x} cy={pos.y} r="9" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        </svg>
      )}

      {!dark && state.phase !== 'done' && (
        <p className="text-xs text-muted">Zlatá = hlavní šňůra se šipkami k nejbližšímu východu · bílá = boční šňůra · tečkovaně = mezera bez šňůry · modrý bod = tvoje značka</p>
      )}

      {state.phase !== 'done' && state.log.slice(-2).map((event, i) => <p key={`${state.log.length}-${i}`} className={`text-sm ${dark && event.tone === 'info' ? 'text-muted' : TONE[event.tone]}`} role="status">{event.text}</p>)}

      {untouched && (
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={zeroVis} onChange={(event) => { setZeroVis(event.target.checked); restart(event.target.checked); }} />
          Návrat v nulové viditelnosti
        </label>
      )}

      {state.phase === 'in' && (
        <ul className="space-y-2">
          {neighbors(MAP, state.at).map(({ to, edge }) => {
            const target = nodeOf(MAP, to);
            const gap = !hasLine(MAP, state, state.at, to);
            const back = to === state.from ? ' (zpět)' : '';
            if (!gap) return <li key={to}><Button variant="secondary" className="min-h-14 w-full justify-start text-left" onClick={() => setState(move(MAP, state, to))}>Plavat: {target.label} · {edge.meters} m{back}</Button></li>;
            return (
              <li key={to} className="space-y-2 rounded-2xl border border-border p-2">
                <div className="px-2 text-sm text-muted">Mezera {edge.meters} m bez šňůry směrem k bodu „{target.label}“</div>
                <Button variant="secondary" className="min-h-14 w-full justify-start text-left" disabled={state.spoolsLeft === 0} onClick={() => setState(move(MAP, state, to, true))}>Položit skok cívkou a plavat</Button>
                <Button variant="secondary" className="min-h-14 w-full justify-start text-left" onClick={() => setState(move(MAP, state, to))}>Přeplavat bez šňůry</Button>
              </li>
            );
          })}
          {state.from && (
            <>
              <li><Button variant="secondary" className="min-h-14 w-full justify-start text-left" disabled={!canMark} onClick={() => setState(placeCookie(MAP, state))}>Označit cestu ven vlastní značkou</Button></li>
              <li><Button className="min-h-14 w-full" onClick={() => setState(turn(MAP, state))}>Otočit ponor</Button></li>
            </>
          )}
        </ul>
      )}

      {state.phase === 'out' && (
        <ul className="space-y-2">
          {rotate(feel(MAP, state), state.at).map((line) => (
            <li key={line.to}>
              <Button variant="secondary" className="min-h-14 w-full justify-start text-left" onClick={() => { try { navigator.vibrate?.(30); } catch { /* haptika není všude */ } setState(move(MAP, state, line.to)); }}>
                {dark ? feltLabel(line) : `${nodeOf(MAP, line.to).label} – ${feltLabel(line).toLowerCase()}`}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {state.phase === 'done' && state.outcome && (() => {
        const summary = navDebrief(MAP, state);
        return (
          <div data-testid="cave-debrief">
            <div className={`rounded-2xl border-2 bg-surface p-4 ${OUTCOME[state.outcome.result].css}`}>
              <h3 className="text-xl font-semibold" data-testid="cave-outcome">{OUTCOME[state.outcome.result].title}</h3>
              <p className="mt-1">{state.outcome.text}</p>
              <p className="mt-2 text-sm tabular-nums text-muted">Zbylo {formatCs(state.gasBar, 0)} bar · {formatCs(state.minutes, 0)} min · nejdál {state.metersIn} m od vchodu</p>
            </div>
            {summary.issues.length > 0 && <ul className="mt-3 space-y-1 text-sm">{summary.issues.map((issue) => <li key={issue} className="text-danger">✗ {issue}</li>)}</ul>}
            {summary.notes.length > 0 && <ul className="mt-3 space-y-1 text-sm">{summary.notes.map((note) => <li key={note} className="text-warn">◐ {note}</li>)}</ul>}
            <Button className="mt-4 w-full sm:w-auto" variant="secondary" onClick={() => restart()}>Zkusit znovu</Button>
          </div>
        );
      })()}
    </div>
  );
}
