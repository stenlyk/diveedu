/** Seznam skladeb pro režim poslechu: shrnutí lekcí v pořadí modulů a lekcí. Čistá logika. */

export interface Track {
  lessonId: string;
  moduleId: string;
  title: string;
  moduleTitle: string;
}

interface ModuleLike { id: string; title: string; order: number }
interface LessonLike { id: string; moduleId: string; title: string; order: number }

/** moduleId = 'all' vrátí všechny lekce. */
export function buildPlaylist(modules: readonly ModuleLike[], lessons: readonly LessonLike[], moduleId: string): Track[] {
  const ordered = [...modules].sort((a, b) => a.order - b.order).filter((module) => moduleId === 'all' || module.id === moduleId);
  return ordered.flatMap((module) =>
    lessons.filter((lesson) => lesson.moduleId === module.id).sort((a, b) => a.order - b.order)
      .map((lesson) => ({ lessonId: lesson.id, moduleId: module.id, title: lesson.title, moduleTitle: module.title })));
}

/** Posun v seznamu; mimo rozsah vrací null (konec seznamu, nebo není kam zpět). */
export function step(index: number, length: number, delta: 1 | -1): number | null {
  const next = index + delta;
  return next >= 0 && next < length ? next : null;
}

export const RATES = [1, 1.25, 1.5] as const;
export type Rate = (typeof RATES)[number];

export const nextRate = (rate: number): Rate => RATES[(RATES.indexOf(rate as Rate) + 1) % RATES.length]!;
