import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { useEffect, useMemo, useRef } from 'react';
import type { Concept, Relation } from '../content/schema';
import type { Mastery } from '../srs/mastery';

interface Node extends SimulationNodeDatum {
  id: string;
  label: string;
}

const LEVEL_FILL: Record<Mastery['level'], string> = { strong: 'var(--ok)', medium: 'var(--warn)', weak: 'var(--danger)', unknown: 'var(--bg)' };
const RADIUS = 14;

interface Props {
  concepts: Concept[];
  relations: Relation[];
  mastery?: ReadonlyMap<string, Mastery>;
  /** Uzly ke zvýraznění (řetěz příčin); ostatní se ztlumí. */
  highlight?: readonly string[];
  selectedId?: string;
  onSelect: (conceptId: string) => void;
}

/**
 * Globální mapa grafu. Rozložení se spočítá jednou (silová simulace doběhne předem),
 * takže se na mobilu nic neanimuje; posun a zoom řeší d3-zoom včetně dotykových gest.
 */
export function GraphMap({ concepts, relations, mastery, highlight = [], selectedId, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<{ by: (factor: number) => void; reset: () => void } | null>(null);

  const layout = useMemo(() => {
    const nodes: Node[] = concepts.map((concept) => ({ id: concept.id, label: concept.label }));
    const ids = new Set(nodes.map((node) => node.id));
    const links = relations.filter((r) => ids.has(r.from) && ids.has(r.to)).map((r) => ({ source: r.from, target: r.to, relation: r }));
    const simulation = forceSimulation(nodes)
      .force('link', forceLink<Node, (typeof links)[number]>(links).id((node) => node.id).distance(62).strength(0.6))
      .force('charge', forceManyBody().strength(-170))
      .force('collide', forceCollide(RADIUS * 2.6))
      .force('center', forceCenter(0, 0))
      .stop();
    for (let i = 0; i < 300; i++) simulation.tick();
    const xs = nodes.map((node) => node.x ?? 0);
    const ys = nodes.map((node) => node.y ?? 0);
    const pad = 60;
    const box = nodes.length
      ? { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + 2 * pad, h: Math.max(...ys) - Math.min(...ys) + 2 * pad }
      : { x: -100, y: -100, w: 200, h: 200 };
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return { nodes, links: links.map((link) => ({ relation: link.relation, from: byId.get(link.relation.from)!, to: byId.get(link.relation.to)! })), box };
  }, [concepts, relations]);

  useEffect(() => {
    const svg = svgRef.current;
    const group = groupRef.current;
    if (!svg || !group) return;
    const behavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 5]).on('zoom', (event) => group.setAttribute('transform', event.transform.toString()));
    const selection = select(svg);
    selection.call(behavior).call(behavior.transform, zoomIdentity);
    zoomRef.current = { by: (factor) => behavior.scaleBy(selection, factor), reset: () => behavior.transform(selection, zoomIdentity) };
    return () => { selection.on('.zoom', null); zoomRef.current = null; };
  }, [layout]);

  const lit = new Set(highlight);
  const dim = (id: string) => lit.size > 0 && !lit.has(id);
  const { box } = layout;

  const zoomButton = 'flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-xl font-semibold';
  return (
    <div className="relative">
      {/* Zoom tlačítky: mapa jde ovládat jedním palcem, bez gesta dvěma prsty. */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-2">
        <button type="button" className={zoomButton} aria-label="Přiblížit" onClick={() => zoomRef.current?.by(1.5)}>+</button>
        <button type="button" className={zoomButton} aria-label="Oddálit" onClick={() => zoomRef.current?.by(1 / 1.5)}>−</button>
        <button type="button" className={zoomButton} aria-label="Celá mapa" onClick={() => zoomRef.current?.reset()}>⤢</button>
      </div>
    <svg ref={svgRef} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="h-[60dvh] min-h-80 w-full rounded-2xl border border-border bg-surface" style={{ touchAction: 'none' }} role="group" aria-label={`Mapa znalostního grafu, ${layout.nodes.length} pojmů`} data-testid="graph-map">
      <defs>
        <marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)" /></marker>
        <marker id="map-arrow-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)" /></marker>
      </defs>
      <g ref={groupRef}>
        {layout.links.map(({ relation, from, to }) => {
          const dx = (to.x ?? 0) - (from.x ?? 0);
          const dy = (to.y ?? 0) - (from.y ?? 0);
          const length = Math.hypot(dx, dy) || 1;
          const onPath = lit.has(relation.from) && lit.has(relation.to);
          return (
            <line
              key={`${relation.from}-${relation.type}-${relation.to}`}
              x1={(from.x ?? 0) + (dx / length) * RADIUS}
              y1={(from.y ?? 0) + (dy / length) * RADIUS}
              x2={(to.x ?? 0) - (dx / length) * (RADIUS + 2)}
              y2={(to.y ?? 0) - (dy / length) * (RADIUS + 2)}
              stroke={onPath ? 'var(--accent)' : 'var(--muted)'}
              strokeWidth={onPath ? 2 : 1}
              opacity={lit.size > 0 && !onPath ? 0.15 : 0.55}
              markerEnd={`url(#${onPath ? 'map-arrow-lit' : 'map-arrow'})`}
            />
          );
        })}
        {layout.nodes.map((node) => {
          const level = mastery?.get(node.id)?.level ?? 'unknown';
          const selected = node.id === selectedId;
          return (
            <g key={node.id} transform={`translate(${node.x ?? 0},${node.y ?? 0})`} opacity={dim(node.id) ? 0.25 : 1} role="button" tabIndex={0} aria-label={node.label} aria-pressed={selected} data-node={node.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(node.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id); } }}>
              {/* Větší neviditelný terč pro prst. */}
              <circle r={RADIUS * 2} fill="transparent" />
              <circle r={RADIUS} fill={LEVEL_FILL[level]} stroke={selected || lit.has(node.id) ? 'var(--accent)' : 'var(--muted)'} strokeWidth={selected || lit.has(node.id) ? 4 : 2} />
              <text y={RADIUS + 15} textAnchor="middle" fontSize="13" fill="var(--text)" stroke="var(--surface)" strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{node.label}</text>
            </g>
          );
        })}
      </g>
    </svg>
    </div>
  );
}
