/** Časování animovaného výkladu: kdy která věta začíná a kde v ní právě jsme. Čistá logika. */

/** Odhad tempa čtení pro přehrávání bez nahraného hlasu (znaků za sekundu) a pauza mezi větami. */
const CHARS_PER_SECOND = 14;
const GAP_SECONDS = 0.6;
const MIN_CUE_SECONDS = 2.5;

export interface Timeline {
  /** Začátek každé věty v sekundách. */
  starts: number[];
  duration: number;
}

/** Časování bez nahrávky: délka věty podle počtu znaků. */
export function estimatedTimeline(cues: readonly string[]): Timeline {
  const starts: number[] = [];
  let time = 0;
  for (const cue of cues) {
    starts.push(time);
    time += Math.max(MIN_CUE_SECONDS, cue.length / CHARS_PER_SECOND) + GAP_SECONDS;
  }
  return { starts, duration: time };
}

/** Časování z nahrávky; neodpovídá-li počet vět, použije se odhad. */
export function recordedTimeline(cues: readonly string[], starts: readonly number[] | undefined, seconds: number | undefined): Timeline {
  const valid = starts !== undefined && seconds !== undefined && starts.length === cues.length && starts.every((start, i) => start >= 0 && start < seconds && (i === 0 || start > starts[i - 1]!));
  return valid ? { starts: [...starts], duration: seconds } : estimatedTimeline(cues);
}

export interface Position {
  cue: number;
  /** Postup uvnitř věty, 0–1. */
  p: number;
}

export function positionAt(timeline: Timeline, t: number): Position {
  const time = Math.max(0, Math.min(t, timeline.duration));
  let cue = 0;
  for (let i = 0; i < timeline.starts.length; i++) if (timeline.starts[i]! <= time) cue = i;
  const start = timeline.starts[cue] ?? 0;
  const end = timeline.starts[cue + 1] ?? timeline.duration;
  return { cue, p: end > start ? Math.min(1, (time - start) / (end - start)) : 1 };
}

/** Rozdělí délku nahrávky mezi věty podle počtu znaků (pro hlas, který časové značky nevrací). */
export function proportionalStarts(cues: readonly string[], seconds: number): number[] {
  const total = cues.reduce((sum, cue) => sum + cue.length, 0) || 1;
  let before = 0;
  return cues.map((cue) => {
    const start = (before / total) * seconds;
    before += cue.length;
    return Math.round(start * 100) / 100;
  });
}

/** Začátky vět z časových značek po znacích: text je složený z vět oddělených jednou mezerou. */
export function startsFromCharacters(cues: readonly string[], characterStarts: readonly number[]): number[] | null {
  const starts: number[] = [];
  let offset = 0;
  for (const cue of cues) {
    const start = characterStarts[offset];
    if (start === undefined) return null;
    starts.push(Math.round(start * 100) / 100);
    offset += cue.length + 1;
  }
  return starts;
}

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
export const lerp = (from: number, to: number, p: number): number => from + (to - from) * clamp01(p);
/** Plynulý rozjezd a dojezd. */
export const ease = (p: number): number => { const x = clamp01(p); return x * x * (3 - 2 * x); };
/** Postup v části věty: 0 před začátkem úseku, 1 po jeho konci. */
export const span = (p: number, from: number, to: number): number => clamp01((p - from) / (to - from));
