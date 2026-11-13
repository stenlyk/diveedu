import type { ReactNode } from 'react';
import { DIAGRAMS } from './diagramDefs';

const GOLD = 'var(--warn)';
const arrow = (x: number, y: number, angle: number) => <polygon points="9,0 -7,-7 -3,0 -7,7" fill={GOLD} transform={`translate(${x} ${y}) rotate(${angle})`} />;

/** Kresby diagramů; klíče odpovídají diagramDefs. */
const ART: Record<string, ReactNode> = {
  'rozcesti-t': (
    <>
      <line x1="30" y1="70" x2="290" y2="70" stroke={GOLD} strokeWidth="3" />
      <line x1="160" y1="70" x2="160" y2="176" stroke={GOLD} strokeWidth="3" />
      {arrow(96, 70, 180)}
      {arrow(224, 70, 0)}
      {arrow(160, 118, -90)}
      <circle cx="134" cy="70" r="8" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
      <text x="174" y="182" fontSize="10" fill="var(--muted)">přicházíš odtud</text>
    </>
  ),
  skok: (
    <>
      <line x1="20" y1="142" x2="300" y2="122" stroke={GOLD} strokeWidth="3" />
      {arrow(110, 135.5, 176)}
      <line x1="176" y1="130" x2="192" y2="80" stroke="var(--muted)" strokeWidth="2" strokeDasharray="2 6" />
      <line x1="192" y1="80" x2="296" y2="30" stroke="var(--text)" strokeWidth="2" />
      <text x="24" y="166" fontSize="10" fill="var(--muted)">hlavní šňůra</text>
      <text x="222" y="86" fontSize="10" fill="var(--muted)">boční šňůra</text>
    </>
  ),
  uvazani: (
    <>
      <line x1="0" y1="26" x2="124" y2="26" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 5" />
      <polygon points="124,0 320,0 320,104 252,110 184,100 132,84" fill="var(--border)" />
      <polygon points="0,150 60,142 140,150 220,160 320,164 320,190 0,190" fill="var(--border)" />
      <text x="6" y="16" fontSize="10" fill="var(--muted)">hladina</text>
      <text x="14" y="80" fontSize="10" fill="var(--muted)">otevřená voda</text>
      <text x="200" y="50" fontSize="10" fill="var(--muted)">skalní strop</text>
      <text x="206" y="182" fontSize="10" fill="var(--muted)">chodba</text>
    </>
  ),
  znacky: (
    <>
      <line x1="20" y1="80" x2="300" y2="80" stroke={GOLD} strokeWidth="3" />
      <polygon points="92,80 56,62 62,80 56,98" fill="var(--text)" />
      <circle cx="160" cy="80" r="17" fill="var(--text)" />
      <rect x="230" y="66" width="40" height="28" rx="3" fill="var(--text)" />
    </>
  ),
};

/** Diagram s označitelnými body. Body jsou i pod diagramem jako tlačítka (čtečky, přesný dotyk). */
export function Diagram({ id, selected, locked, answer, onSelect }: { id: string; selected: string | null; locked: boolean; answer: string; onSelect: (hotspot: string) => void }) {
  const def = DIAGRAMS[id];
  if (!def) return null;
  const tone = (hotspot: string) => (locked ? (hotspot === answer ? 'var(--ok)' : hotspot === selected ? 'var(--danger)' : 'var(--muted)') : hotspot === selected ? 'var(--accent)' : 'var(--muted)');
  return (
    <div data-testid="diagram">
      <svg viewBox="0 0 320 190" role="img" aria-label={def.title} className="w-full rounded-2xl bg-surface-2">
        {ART[id]}
        {def.hotspots.map((hotspot) => (
          <g key={hotspot.id} aria-hidden="true" onClick={() => !locked && onSelect(hotspot.id)} style={{ cursor: locked ? 'default' : 'pointer' }}>
            <circle cx={hotspot.x} cy={hotspot.y} r="22" fill="transparent" />
            <circle cx={hotspot.x} cy={hotspot.y - 24 < 12 ? hotspot.y + 24 : hotspot.y - 24} r="11" fill="var(--surface)" stroke={tone(hotspot.id)} strokeWidth={hotspot.id === selected || (locked && hotspot.id === answer) ? 3 : 1.5} />
            <text x={hotspot.x} y={(hotspot.y - 24 < 12 ? hotspot.y + 24 : hotspot.y - 24) + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={tone(hotspot.id)}>{hotspot.id.toUpperCase()}</text>
          </g>
        ))}
      </svg>
      <div className="mt-3 flex gap-2">
        {def.hotspots.map((hotspot) => (
          <button key={hotspot.id} type="button" disabled={locked} aria-pressed={hotspot.id === selected} aria-label={`Bod ${hotspot.id.toUpperCase()}`} onClick={() => onSelect(hotspot.id)}
            className={`min-h-12 flex-1 rounded-xl border-2 text-lg font-semibold ${locked ? (hotspot.id === answer ? 'border-ok text-ok' : hotspot.id === selected ? 'border-danger text-danger' : 'border-border opacity-60') : hotspot.id === selected ? 'border-accent text-accent' : 'border-border'}`}>
            {hotspot.id.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
