/**
 * Výukový model navigace v jeskyni: mapa jako graf, souvislá šňůra, skoky přes mezery, osobní značky,
 * tlak otočky a návrat po hmatu. Čistá logika bez Reactu. Není to plánovač ponoru.
 */
import { sacBarPerMinute, thirdsTurnBar } from '@diveedu/calc';

export type LineKind = 'main' | 'side' | 'none';

export interface CaveNode {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: 'entrance' | 'other-exit' | 'point' | 'junction' | 'end';
}

export interface CaveEdge {
  a: string;
  b: string;
  meters: number;
  /** main = trvalá hlavní šňůra, side = trvalá boční šňůra, none = mezera bez šňůry. */
  line: LineKind;
  /** Uzel, ke kterému ukazuje trvalá směrová šipka na tomto úseku (k nejbližšímu východu). */
  arrowTo?: string;
}

export interface CaveMap {
  id: string;
  title: string;
  nodes: CaveNode[];
  edges: CaveEdge[];
  start: string;
  depthM: number;
  tankLiters: number;
  startBar: number;
  sacLpm: number;
  speedInMpm: number;
  speedOutMpm: number;
  /** Rychlost návratu po hmatu v nulové viditelnosti. */
  speedBlindMpm: number;
  cookies: number;
  spools: number;
}

export type ViolationKind = 'gap' | 'turn-late' | 'wrong-turn' | 'unmarked';

export interface NavEvent {
  text: string;
  tone: 'info' | 'good' | 'bad';
}

export interface NavState {
  at: string;
  /** Uzel, ze kterého potápěč připlaval; určuje „cestu zpět“. */
  from: string | null;
  phase: 'in' | 'out' | 'done';
  zeroVisibility: boolean;
  gasBar: number;
  minutes: number;
  metersIn: number;
  /** Osobní značky: klíč „uzel>soused“ = na šňůře z uzlu směrem k sousedovi. */
  cookies: string[];
  /** Mezery přemostěné vlastní cívkou: klíč úseku. */
  jumps: string[];
  cookiesLeft: number;
  spoolsLeft: number;
  /** Uzly, kde při cestě dovnitř bylo na výběr a potápěč nic neoznačil. */
  unmarked: string[];
  violations: { kind: ViolationKind; text: string }[];
  log: NavEvent[];
  outcome?: { result: 'success' | 'partial' | 'fail'; text: string };
}

export interface FeltLine {
  to: string;
  /** Vlastní značka na této šňůře. */
  cookie: boolean;
  /** Trvalá šipka: away = ukazuje od potápěče tímto směrem, toward = ukazuje proti němu. */
  arrow: 'away' | 'toward' | null;
  /** Vlastní skoková šňůra. */
  jump: boolean;
  /** Úsek bez šňůry: plavání naslepo. */
  blind: boolean;
  /** Šňůra, po které potápěč právě připlaval. */
  back: boolean;
}

const edgeKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
const markKey = (node: string, toward: string): string => `${node}>${toward}`;

export function edgeBetween(map: CaveMap, a: string, b: string): CaveEdge | undefined {
  return map.edges.find((edge) => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a));
}

export function neighbors(map: CaveMap, node: string): { to: string; edge: CaveEdge }[] {
  return map.edges.flatMap((edge) => (edge.a === node ? [{ to: edge.b, edge }] : edge.b === node ? [{ to: edge.a, edge }] : []));
}

export function nodeOf(map: CaveMap, id: string): CaveNode {
  const node = map.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Neznámý bod mapy: ${id}`);
  return node;
}

export const turnBar = (map: CaveMap): number => thirdsTurnBar(map.startBar);

/** Má úsek šňůru – trvalou, nebo položenou vlastní cívkou? */
export function hasLine(map: CaveMap, state: Pick<NavState, 'jumps'>, a: string, b: string): boolean {
  const edge = edgeBetween(map, a, b);
  return !!edge && (edge.line !== 'none' || state.jumps.includes(edgeKey(a, b)));
}

/** Vzdálenost v metrech k výchozímu vchodu po úsecích; bez cesty Infinity. */
export function metersToStart(map: CaveMap, from: string): number {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    // Graf je malý; výběr nejbližšího uzlu lineárním průchodem stačí.
    queue.sort((p, q) => dist.get(p)! - dist.get(q)!);
    const current = queue.shift()!;
    if (current === map.start) return dist.get(current)!;
    for (const { to, edge } of neighbors(map, current)) {
      const next = dist.get(current)! + edge.meters;
      if (next < (dist.get(to) ?? Infinity)) {
        dist.set(to, next);
        if (!queue.includes(to)) queue.push(to);
      }
    }
  }
  return Infinity;
}

export function startNav(map: CaveMap, zeroVisibility = true): NavState {
  return {
    at: map.start, from: null, phase: 'in', zeroVisibility, gasBar: map.startBar, minutes: 0, metersIn: 0,
    cookies: [], jumps: [], cookiesLeft: map.cookies, spoolsLeft: map.spools, unmarked: [], violations: [],
    log: [{ text: `Vchod. V lahvích ${map.startBar} bar, tlak otočky ${turnBar(map)} bar.`, tone: 'info' }],
  };
}

function spend(map: CaveMap, state: NavState, minutes: number): NavState {
  const gasBar = Math.max(0, state.gasBar - minutes * sacBarPerMinute(map.sacLpm, map.depthM, map.tankLiters));
  return { ...state, gasBar, minutes: state.minutes + minutes };
}

const finish = (state: NavState, result: 'success' | 'partial' | 'fail', text: string): NavState => ({
  ...state, phase: 'done', outcome: { result, text }, log: [...state.log, { text, tone: result === 'fail' ? 'bad' : result === 'success' ? 'good' : 'info' }],
});

/** Je v uzlu při návratu na výběr víc šňůr než ta, po které se přišlo, a cesta zpět? */
export function isDecisionPoint(map: CaveMap, state: Pick<NavState, 'jumps'>, node: string): boolean {
  return neighbors(map, node).filter(({ to }) => hasLine(map, state, node, to)).length >= 3;
}

/** Označí osobní značkou šňůru, po které potápěč do uzlu připlaval (cestu k jeho východu). */
export function placeCookie(map: CaveMap, state: NavState): NavState {
  if (state.phase !== 'in' || !state.from || state.cookiesLeft <= 0) return state;
  const key = markKey(state.at, state.from);
  if (state.cookies.includes(key)) return state;
  const next = spend(map, state, 0.5);
  return { ...next, cookies: [...next.cookies, key], cookiesLeft: next.cookiesLeft - 1, log: [...next.log, { text: `Značka na šňůře směrem k tvému východu (${nodeOf(map, state.at).label}).`, tone: 'good' }] };
}

/** Otočka: začíná návrat. */
export function turn(map: CaveMap, state: NavState): NavState {
  if (state.phase !== 'in') return state;
  const late = state.gasBar < turnBar(map);
  const text = state.zeroVisibility ? 'Otočka. Vzápětí se zvedá sediment: viditelnost je nulová, zpět jdeš po hmatu.' : 'Otočka. Vracíš se po šňůře.';
  return {
    ...state, phase: 'out', from: null,
    log: [...state.log, { text, tone: 'info' }, ...(late ? [{ text: `Otáčíš s ${Math.round(state.gasBar)} bar – pod tlakem otočky.`, tone: 'bad' as const }] : [])],
  };
}

/** Přesun do sousedního uzlu. U mezery bez šňůry rozhoduje useSpool, zda se položí skok. */
export function move(map: CaveMap, state: NavState, to: string, useSpool = false): NavState {
  if (state.phase === 'done') return state;
  const edge = edgeBetween(map, state.at, to);
  if (!edge) return state;
  const key = edgeKey(state.at, to);
  const lined = hasLine(map, state, state.at, to);
  let next = state;
  const log: NavEvent[] = [];
  const violations = [...state.violations];
  let unmarked = state.unmarked;

  if (state.phase === 'in') {
    // Odchod z rozcestí bez označení cesty ven.
    if (state.from && to !== state.from && isDecisionPoint(map, state, state.at) && !state.cookies.includes(markKey(state.at, state.from)) && !unmarked.includes(state.at)) {
      unmarked = [...unmarked, state.at];
    }
    if (!lined) {
      if (useSpool && state.spoolsLeft > 0) {
        next = spend(map, { ...next, jumps: [...next.jumps, key], spoolsLeft: next.spoolsLeft - 1 }, 2);
        log.push({ text: 'Skok: mezeru jsi přemostil vlastní cívkou. Šňůra k východu je souvislá.', tone: 'good' });
        if (state.from && !unmarked.includes(state.at) && !state.cookies.includes(markKey(state.at, state.from)) && isDecisionPoint(map, next, state.at)) unmarked = [...unmarked, state.at];
      } else {
        violations.push({ kind: 'gap', text: `Mezeru u bodu ${nodeOf(map, state.at).label} jsi přeplaval bez šňůry.` });
        log.push({ text: 'Přeplaval jsi mezeru bez šňůry. Souvislá šňůra k východu je přerušená.', tone: 'bad' });
      }
    }
    next = spend(map, next, edge.meters / map.speedInMpm);
    next = { ...next, at: to, from: state.at, metersIn: metersToStart(map, to), unmarked, violations, log: [...next.log, ...log, { text: `${nodeOf(map, to).label} · ${edge.meters} m`, tone: 'info' }] };
    if (next.gasBar < turnBar(map) && !violations.some((v) => v.kind === 'turn-late')) {
      next = { ...next, violations: [...next.violations, { kind: 'turn-late', text: `Pokračoval jsi za tlak otočky (${turnBar(map)} bar).` }], log: [...next.log, { text: 'Jsi pod tlakem otočky. Rezerva pro partnera se zmenšuje.', tone: 'bad' }] };
    }
  } else {
    if (!lined && state.zeroVisibility) {
      return finish({ ...spend(map, state, 5), violations }, 'fail', 'Pustil ses šňůry a plaval naslepo. V nulové viditelnosti jsi druhou šňůru nenašel.');
    }
    const before = metersToStart(map, state.at);
    const speed = state.zeroVisibility ? map.speedBlindMpm : map.speedOutMpm;
    next = spend(map, next, edge.meters / speed);
    const after = metersToStart(map, to);
    if (after > before) {
      violations.push({ kind: 'wrong-turn', text: `U bodu ${nodeOf(map, state.at).label} ses vydal od svého východu.` });
      log.push({ text: `Po ${edge.meters} m zjišťuješ, že se od svého východu vzdaluješ.`, tone: 'bad' });
    }
    const collected = next.cookies.filter((mark) => mark.startsWith(`${state.at}>`));
    next = {
      ...next, at: to, from: state.at, violations,
      cookies: next.cookies.filter((mark) => !collected.includes(mark)), cookiesLeft: next.cookiesLeft + collected.length,
      log: [...next.log, ...log, ...(state.zeroVisibility ? [] : [{ text: `${nodeOf(map, to).label} · ${edge.meters} m`, tone: 'info' as const }])],
    };
  }

  if (next.gasBar <= 0) return finish(next, 'fail', 'Došel plyn.');
  if (next.phase === 'out') {
    const node = nodeOf(map, to);
    if (to === map.start) {
      const clean = next.violations.length === 0;
      return finish(next, clean ? 'success' : 'partial', clean ? 'Jsi u svého vchodu, se souvislou šňůrou po celou dobu a s rezervou plynu.' : 'Jsi u svého vchodu. Rozbor ale ukazuje místa, kde to mohlo dopadnout jinak.');
    }
    if (node.kind === 'other-exit') {
      return finish(next, 'partial', 'Vynořil ses jiným vchodem, než kterým jsi vplaval – bez plánu, bez podpory na hladině a daleko od výstroje. Šipky vedou k nejbližšímu východu, ne k tvému.');
    }
  }
  return next;
}

/** Co potápěč v uzlu nahmatá: šňůry a značky na nich. */
export function feel(map: CaveMap, state: NavState): FeltLine[] {
  return neighbors(map, state.at).map(({ to, edge }) => ({
    to,
    cookie: state.cookies.includes(markKey(state.at, to)),
    arrow: edge.line !== 'none' && edge.arrowTo ? (edge.arrowTo === to ? 'away' : 'toward') : null,
    jump: edge.line === 'none' && state.jumps.includes(edgeKey(state.at, to)),
    blind: !hasLine(map, state, state.at, to),
    back: to === state.from,
  }));
}

/** Shrnutí pro rozbor. */
export function navDebrief(map: CaveMap, state: NavState): { issues: string[]; notes: string[] } {
  const issues = state.violations.map((violation) => violation.text);
  const notes = state.unmarked.map((id) => `Bod „${nodeOf(map, id).label}“ jsi cestou dovnitř neoznačil vlastní značkou.`);
  if (state.phase === 'done' && state.outcome?.result !== 'fail' && state.gasBar < map.startBar / 3) {
    if (state.zeroVisibility) notes.push(`Návrat po hmatu ukrojil z rezervní třetiny: zbylo ${Math.round(state.gasBar)} bar. Ztráta viditelnosti a partner bez plynu zároveň by se do třetin nevešly.`);
    else issues.push(`Zbylo ${Math.round(state.gasBar)} bar – méně než rezervní třetina. Partnera bez plynu bys ven nedovezl.`);
  }
  return { issues, notes };
}

/** Výuková mapa: hlavní šňůra, rozcestí T ke druhému vchodu, boční chodba za mezerou. */
export const TRAINING_CAVE: CaveMap = {
  id: 'vyukova-jeskyne',
  title: 'Výuková jeskyně',
  start: 'v1',
  depthM: 24, tankLiters: 24, startBar: 210, sacLpm: 20,
  speedInMpm: 15, speedOutMpm: 15, speedBlindMpm: 10,
  cookies: 3, spools: 2,
  nodes: [
    { id: 'v1', label: 'Vchod 1', x: 28, y: 150, kind: 'entrance' },
    { id: 'a', label: 'Síň A', x: 88, y: 132, kind: 'point' },
    { id: 't', label: 'Rozcestí T', x: 150, y: 120, kind: 'junction' },
    { id: 'c', label: 'Komín', x: 150, y: 64, kind: 'point' },
    { id: 'v2', label: 'Vchod 2', x: 118, y: 22, kind: 'other-exit' },
    { id: 'b', label: 'Dóm B', x: 216, y: 126, kind: 'point' },
    { id: 'j', label: 'Začátek boční šňůry', x: 226, y: 96, kind: 'point' },
    { id: 's', label: 'Boční síň', x: 270, y: 54, kind: 'end' },
    { id: 'd', label: 'Konec hlavní šňůry', x: 296, y: 150, kind: 'end' },
  ],
  edges: [
    { a: 'v1', b: 'a', meters: 80, line: 'main', arrowTo: 'v1' },
    { a: 'a', b: 't', meters: 80, line: 'main', arrowTo: 'a' },
    { a: 't', b: 'c', meters: 60, line: 'main', arrowTo: 'c' },
    { a: 'c', b: 'v2', meters: 60, line: 'main', arrowTo: 'v2' },
    { a: 't', b: 'b', meters: 90, line: 'main', arrowTo: 't' },
    { a: 'b', b: 'd', meters: 150, line: 'main', arrowTo: 'b' },
    { a: 'b', b: 'j', meters: 5, line: 'none' },
    { a: 'j', b: 's', meters: 55, line: 'side' },
  ],
};
