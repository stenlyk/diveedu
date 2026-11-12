/** Přístup ke zkompilovanému obsahu. Obsah je za běhu neměnný. */
import type { ComponentType } from 'react';
import raw from './generated/content.json';
import type { Concept, Content, Lesson, Module, Question, Relation } from './schema';

export const content = raw as unknown as Content;

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));

export const modulesById = byId(content.modules);
export const lessonsById = byId(content.lessons);
export const conceptsById = byId(content.concepts);
export const questionsById = byId(content.questions);
export const formulasById = byId(content.formulas);
export const factsById = byId(content.facts);
export const glossaryByCs = new Map(content.glossary.map((term) => [term.cs.toLowerCase(), term]));

export const lessonsOfModule = (moduleId: string): Lesson[] => content.lessons.filter((lesson) => lesson.moduleId === moduleId);

export const questionsOfModule = (moduleId: string): Question[] =>
  content.questions.filter((question) => question.conceptIds.some((id) => conceptsById.get(id)?.moduleId === moduleId));

export interface Neighbourhood {
  concept: Concept;
  causes: { relation: Relation; concept: Concept }[];
  effects: { relation: Relation; concept: Concept }[];
}

/** Lokální okolí uzlu: co na něj působí (vlevo) a na co působí on (vpravo). */
export function neighbourhood(conceptId: string): Neighbourhood | undefined {
  const concept = conceptsById.get(conceptId);
  if (!concept) return undefined;
  const link = (relation: Relation, otherId: string) => {
    const other = conceptsById.get(otherId);
    return other ? [{ relation, concept: other }] : [];
  };
  return {
    concept,
    causes: content.relations.filter((r) => r.to === conceptId).flatMap((r) => link(r, r.from)),
    effects: content.relations.filter((r) => r.from === conceptId).flatMap((r) => link(r, r.to)),
  };
}

export function moduleUnlocked(module: Module, passedModuleIds: ReadonlySet<string>): boolean {
  return module.prerequisites.every((id) => passedModuleIds.has(id));
}

// MDX těla lekcí se načítají líně po jedné lekci.
const lessonModules = import.meta.glob<{ default: ComponentType }>('../../content/modules/*/lessons/*/lesson.mdx');

export function loadLessonBody(lesson: Lesson & { path: string }): Promise<ComponentType> {
  const loader = lessonModules[`../../content/${lesson.path}`];
  if (!loader) return Promise.reject(new Error(`Tělo lekce ${lesson.id} nenalezeno`));
  return loader().then((module) => module.default);
}
