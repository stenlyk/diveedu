/**
 * Validace obsahu: schémata + křížové kontroly. Čistá funkce nad načtenými daty,
 * aby šla testovat bez souborového systému.
 */
import { callContentFunction, isContentFunction } from '../../src/content/fns';
import type { z } from 'zod';
import { CUSTOM_PLAYGROUND_KINDS } from '../../src/mdx/playgroundKinds';
import { DIAGRAMS } from '../../src/quiz/diagramDefs';
import { CALC_DEFS } from '../../src/tools/defs';
import {
  CaseStudySchema,
  ConceptSchema,
  type Content,
  FactSchema,
  FormulaSchema,
  GlossaryTermSchema,
  LESSON_SECTIONS,
  LessonSchema,
  MediaSchema,
  ModuleSchema,
  type NumericTemplate,
  QuestionSchema,
  RelationSchema,
  ScenarioSchema,
} from '../../src/content/schema';

export interface RawLesson {
  path: string;
  meta: unknown;
  /** Názvy JSX elementů nejvyšší úrovně v lesson.mdx. */
  topLevelElements: string[];
  /** Všechny <Calc> a <Worked> v lekci. */
  calcCalls: CalcCall[];
  /** Odkazy na další obsah: <Playground kind>, <Fact id>, <CaseLink id>, <Formula id>, <Term cs>. */
  refs?: { element: string; value: string }[];
  /** Úryvky textu s ručně psaným výsledkem v částech Vzorec a Ukázkový výpočet. */
  handWritten?: string[];
}

export interface CalcCall {
  element: 'Calc' | 'Worked';
  fn?: string;
  args?: unknown;
  expected?: unknown;
  tolerance?: unknown;
  steps?: string;
}

export interface RawContent {
  modules: { path: string; data: unknown }[];
  lessons: RawLesson[];
  concepts: unknown[];
  relations: unknown[];
  formulas: unknown[];
  questions: { path: string; data: unknown }[];
  cases: { path: string; data: unknown }[];
  scenarios?: { path: string; data: unknown }[];
  facts: unknown[];
  glossary: unknown[];
  media: unknown[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  content: Content;
}

export const MIN_QUESTIONS_PER_MODULE = 40;
export const MIN_QUESTIONS_PER_CONCEPT = 3;
export const MIN_RELATIONS_PER_LESSON = 2;

const isCalcFn = isContentFunction;

function parseAll<S extends z.ZodType>(schema: S, items: unknown[], where: (i: number) => string, errors: string[]): z.infer<S>[] {
  const out: z.infer<S>[] = [];
  items.forEach((item, i) => {
    const result = schema.safeParse(item);
    if (result.success) out.push(result.data);
    else {
      for (const issue of result.error.issues) {
        errors.push(`${where(i)}: ${issue.path.join('.') || '(kořen)'} – ${issue.message}`);
      }
    }
  });
  return out;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const value of ids) (seen.has(value) ? dup : seen).add(value);
  return [...dup];
}

/** Krajní kombinace parametrů šablony (min/max nebo první/poslední hodnota). */
export function templateCorners(template: NumericTemplate): Record<string, number>[] {
  let combos: Record<string, number>[] = [{ ...template.fixed }];
  for (const [name, param] of Object.entries(template.params)) {
    const ends = 'values' in param ? [param.values[0]!, param.values[param.values.length - 1]!] : [param.min, param.max];
    combos = combos.flatMap((combo) => [...new Set(ends)].map((value) => ({ ...combo, [name]: value })));
  }
  return combos;
}

function hasCycle(modules: { id: string; prerequisites: string[] }[]): boolean {
  const state = new Map<string, 1 | 2>();
  const byId = new Map(modules.map((m) => [m.id, m]));
  const visit = (moduleId: string): boolean => {
    if (state.get(moduleId) === 2) return false;
    if (state.get(moduleId) === 1) return true;
    state.set(moduleId, 1);
    const cyclic = (byId.get(moduleId)?.prerequisites ?? []).some(visit);
    state.set(moduleId, 2);
    return cyclic;
  };
  return modules.some((m) => visit(m.id));
}

export function validateContent(raw: RawContent): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const modules = parseAll(ModuleSchema, raw.modules.map((m) => m.data), (i) => raw.modules[i]!.path, errors);
  const lessons = raw.lessons.flatMap((rawLesson) => {
    const parsed = parseAll(LessonSchema, [rawLesson.meta], () => rawLesson.path, errors);
    return parsed.map((lesson) => ({ ...lesson, path: rawLesson.path, raw: rawLesson }));
  });
  const concepts = parseAll(ConceptSchema, raw.concepts, (i) => `graph/concepts.yaml[${i}]`, errors);
  const relations = parseAll(RelationSchema, raw.relations, (i) => `graph/relations.yaml[${i}]`, errors);
  const formulas = parseAll(FormulaSchema, raw.formulas, (i) => `formulas.yaml[${i}]`, errors);
  const questions = parseAll(QuestionSchema, raw.questions.map((q) => q.data), (i) => raw.questions[i]!.path, errors);
  const cases = parseAll(CaseStudySchema, raw.cases.map((c) => c.data), (i) => raw.cases[i]!.path, errors);
  const rawScenarios = raw.scenarios ?? [];
  const scenarios = parseAll(ScenarioSchema, rawScenarios.map((s) => s.data), (i) => rawScenarios[i]!.path, errors);
  const facts = parseAll(FactSchema, raw.facts, (i) => `facts.yaml[${i}]`, errors);
  const glossary = parseAll(GlossaryTermSchema, raw.glossary, (i) => `glossary.yaml[${i}]`, errors);
  const media = parseAll(MediaSchema, raw.media, (i) => `media.yaml[${i}]`, errors);

  // Unikátní id
  const idSets: [string, string[]][] = [
    ['modul', modules.map((m) => m.id)],
    ['lekce', lessons.map((l) => l.id)],
    ['uzel', concepts.map((c) => c.id)],
    ['vzorec', formulas.map((f) => f.id)],
    ['otázka', questions.map((q) => q.id)],
    ['případová studie', cases.map((c) => c.id)],
    ['scénář', scenarios.map((s) => s.id)],
    ['zajímavost', facts.map((f) => f.id)],
    ['médium', media.map((m) => m.id)],
  ];
  for (const [kind, ids] of idSets) {
    for (const dup of duplicates(ids)) errors.push(`duplicitní id (${kind}): ${dup}`);
  }

  const moduleIds = new Set(modules.map((m) => m.id));
  const lessonIds = new Set(lessons.map((l) => l.id));
  const conceptIds = new Set(concepts.map((c) => c.id));
  const formulaIds = new Set(formulas.map((f) => f.id));
  const questionIds = new Set(questions.map((q) => q.id));
  const mediaIds = new Set(media.map((m) => m.id));
  const factIds = new Set(facts.map((f) => f.id));
  const caseIds = new Set(cases.map((c) => c.id));
  const scenarioIds = new Set(scenarios.map((s) => s.id));
  const glossaryTerms = new Set(glossary.map((g) => g.cs.toLowerCase()));
  const playgroundKinds = new Set<string>([...CUSTOM_PLAYGROUND_KINDS, ...CALC_DEFS.map((def) => def.id)]);
  const needConcepts = (ids: string[], where: string) => {
    for (const conceptId of ids) if (!conceptIds.has(conceptId)) errors.push(`${where}: neznámý uzel „${conceptId}“`);
  };

  // Moduly
  for (const module of modules) {
    for (const prerequisite of module.prerequisites) {
      if (!moduleIds.has(prerequisite)) errors.push(`modul ${module.id}: neznámá prerekvizita „${prerequisite}“`);
    }
    if (module.unlockAfter && !moduleIds.has(module.unlockAfter)) {
      errors.push(`modul ${module.id}: neznámý modul v unlockAfter „${module.unlockAfter}“`);
    }
  }
  if (hasCycle(modules)) errors.push('prerekvizity modulů obsahují cyklus');

  // Lekce
  for (const lesson of lessons) {
    const where = `lekce ${lesson.id}`;
    if (!moduleIds.has(lesson.moduleId)) errors.push(`${where}: neznámý modul „${lesson.moduleId}“`);
    needConcepts(lesson.conceptIds, where);
    for (const questionId of lesson.checkQuestionIds) {
      if (!questionIds.has(questionId)) errors.push(`${where}: neznámá otázka „${questionId}“ v checkQuestionIds`);
    }
    for (const section of LESSON_SECTIONS) {
      const count = lesson.raw.topLevelElements.filter((name) => name === section).length;
      if (count === 0) errors.push(`${where}: chybí sekce <${section}>`);
      if (count > 1) errors.push(`${where}: sekce <${section}> je v lekci ${count}×`);
    }
    const order = lesson.raw.topLevelElements.filter((name) => (LESSON_SECTIONS as readonly string[]).includes(name));
    if (order.length === LESSON_SECTIONS.length && order.some((name, i) => name !== LESSON_SECTIONS[i])) {
      errors.push(`${where}: sekce nejsou v pořadí šablony (${LESSON_SECTIONS.join(' → ')})`);
    }
    const relationCount = relations.filter((r) => r.lessonId === lesson.id).length;
    if (relationCount < MIN_RELATIONS_PER_LESSON) {
      errors.push(`${where}: má ${relationCount} vazeb do grafu, potřebuje alespoň ${MIN_RELATIONS_PER_LESSON}`);
    }
    for (const snippet of lesson.raw.handWritten ?? []) {
      errors.push(`${where}: ručně psaný výsledek „${snippet}“ – použij <Calc> nebo <Worked>`);
    }
    for (const ref of lesson.raw.refs ?? []) {
      const known: Record<string, (value: string) => boolean> = {
        Playground: (value) => playgroundKinds.has(value),
        Fact: (value) => factIds.has(value),
        CaseLink: (value) => caseIds.has(value),
        Formula: (value) => formulaIds.has(value),
        Term: (value) => glossaryTerms.has(value.toLowerCase()),
        Scenario: (value) => scenarioIds.has(value),
      };
      if (!known[ref.element]!(ref.value)) errors.push(`${where}: <${ref.element}> odkazuje na neznámou položku „${ref.value}“`);
    }
    for (const call of lesson.raw.calcCalls) {
      const tag = `${where}: <${call.element}>`;
      if (!call.fn || !isCalcFn(call.fn)) {
        errors.push(`${tag} odkazuje na neznámou funkci „${call.fn}“`);
        continue;
      }
      if (!Array.isArray(call.args)) {
        errors.push(`${tag} fn=${call.fn}: args musí být pole`);
        continue;
      }
      if (call.steps && !isCalcFn(call.steps)) errors.push(`${tag}: neznámá funkce postupu „${call.steps}“`);
      try {
        const value = callContentFunction(call.fn, call.args);
        if (call.element === 'Worked') {
          if (typeof call.expected !== 'number' || typeof call.tolerance !== 'number') {
            errors.push(`${tag} fn=${call.fn}: chybí číselné expected a tolerance`);
          } else if (typeof value !== 'number' || Math.abs(value - call.expected) > call.tolerance) {
            errors.push(`${tag} fn=${call.fn}: calc vrací ${String(value)}, ručně spočtená reference je ${call.expected} ± ${call.tolerance}`);
          }
        }
      } catch (error) {
        errors.push(`${tag} fn=${call.fn}: výpočet selhal – ${(error as Error).message}`);
      }
    }
  }

  // Uzly a hrany
  for (const concept of concepts) {
    const where = `uzel ${concept.id}`;
    if (!moduleIds.has(concept.moduleId)) errors.push(`${where}: neznámý modul „${concept.moduleId}“`);
    for (const lessonId of concept.lessonIds) {
      if (!lessonIds.has(lessonId)) errors.push(`${where}: neznámá lekce „${lessonId}“`);
    }
    if (concept.formulaId && !formulaIds.has(concept.formulaId)) errors.push(`${where}: neznámý vzorec „${concept.formulaId}“`);
  }
  relations.forEach((relation, i) => {
    const where = `vazba #${i} (${relation.from} → ${relation.to})`;
    needConcepts([relation.from, relation.to], where);
    if (relation.from === relation.to) errors.push(`${where}: uzel nemůže mířit sám na sebe`);
    if (!lessonIds.has(relation.lessonId)) errors.push(`${where}: neznámá lekce „${relation.lessonId}“`);
  });
  for (const dup of duplicates(relations.map((r) => `${r.from}|${r.type}|${r.to}`))) {
    errors.push(`duplicitní vazba: ${dup}`);
  }

  // Vzorce
  for (const formula of formulas) {
    if (!isCalcFn(formula.calcFunction)) errors.push(`vzorec ${formula.id}: funkce „${formula.calcFunction}“ není mezi funkcemi calc/deco`);
  }

  // Otázky
  for (const question of questions) {
    const where = `otázka ${question.id}`;
    needConcepts(question.conceptIds, where);
    if (question.backToLessonId && !lessonIds.has(question.backToLessonId)) {
      errors.push(`${where}: neznámá lekce „${question.backToLessonId}“ v backToLessonId`);
    }
    if (question.type === 'choice' || question.type === 'multi' || question.type === 'why') {
      const correct = question.options.filter((o) => o.correct).length;
      if (question.type === 'multi' ? correct < 1 : correct !== 1) {
        errors.push(`${where}: ${question.type === 'multi' ? 'alespoň jedna' : 'právě jedna'} možnost musí být správná (je ${correct})`);
      }
      question.options.forEach((option, i) => {
        if (!option.correct && !option.explanation) errors.push(`${where}: špatná možnost #${i + 1} nemá vysvětlení`);
      });
    }
    if (question.type === 'findError') {
      if (!question.items.some((item) => item.isError)) errors.push(`${where}: žádná položka není označená jako chyba`);
      question.items.forEach((item, i) => {
        if (item.isError && !item.explanation) errors.push(`${where}: chyba #${i + 1} nemá vysvětlení`);
      });
    }
    if (question.type === 'diagram') {
      const diagram = DIAGRAMS[question.diagram];
      if (!diagram) errors.push(`${where}: neznámý diagram „${question.diagram}“`);
      else if (!diagram.hotspots.some((hotspot) => hotspot.id === question.answer)) errors.push(`${where}: diagram „${question.diagram}“ nemá bod „${question.answer}“`);
    }
    if (question.type === 'numeric') {
      const template = question.template;
      if (!isCalcFn(template.fn)) {
        errors.push(`${where}: funkce „${template.fn}“ není mezi funkcemi calc/deco`);
        continue;
      }
      for (const arg of template.args) {
        if (!(arg in template.params) && !(arg in template.fixed)) errors.push(`${where}: argument „${arg}“ nemá definici v params ani fixed`);
      }
      for (const name of Object.keys(template.params)) {
        if (!question.prompt.includes(`{${name}}`) && !question.prompt.includes(`{${name}|percent}`)) errors.push(`${where}: prompt neobsahuje {${name}}`);
      }
      for (const [name, param] of Object.entries(template.params)) {
        if ('min' in param && param.min > param.max) errors.push(`${where}: parametr ${name} má min > max`);
      }
      for (const corner of templateCorners(template)) {
        try {
          const value = callContentFunction(template.fn, template.args.map((a) => corner[a]!));
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            errors.push(`${where}: pro ${JSON.stringify(corner)} funkce nevrací konečné číslo`);
          }
        } catch (error) {
          errors.push(`${where}: pro ${JSON.stringify(corner)} výpočet selhal – ${(error as Error).message}`);
        }
      }
    }
  }

  // Případovky, zajímavosti
  for (const study of cases) {
    const where = `případová studie ${study.id}`;
    for (const moduleId of study.moduleIds) if (!moduleIds.has(moduleId)) errors.push(`${where}: neznámý modul „${moduleId}“`);
    study.errorChain.forEach((link) => needConcepts(link.conceptIds, where));
    for (const task of study.calcTasks) if (!isCalcFn(task.fn)) errors.push(`${where}: funkce „${task.fn}“ není mezi funkcemi calc/deco`);
  }
  for (const fact of facts) {
    needConcepts(fact.conceptIds, `zajímavost ${fact.id}`);
    if (fact.image && !mediaIds.has(fact.image)) errors.push(`zajímavost ${fact.id}: neznámé médium „${fact.image}“`);
  }

  // Scénáře: odkazy mezi uzly, dosažitelnost, časové limity a průchodnost správné cesty
  for (const scenario of scenarios) {
    const where = `scénář ${scenario.id}`;
    for (const moduleId of scenario.moduleIds) if (!moduleIds.has(moduleId)) errors.push(`${where}: neznámý modul „${moduleId}“`);
    needConcepts(scenario.conceptIds, where);
    const nodes = new Map(scenario.nodes.map((node) => [node.id, node]));
    for (const dup of duplicates(scenario.nodes.map((n) => n.id))) errors.push(`${where}: duplicitní uzel „${dup}“`);
    if (!nodes.has(scenario.start)) errors.push(`${where}: neznámý počáteční uzel „${scenario.start}“`);
    for (const node of scenario.nodes) {
      if (node.end) {
        if (node.options.length > 0) errors.push(`${where}: koncový uzel „${node.id}“ nesmí mít možnosti`);
        continue;
      }
      if (node.options.length < 2) errors.push(`${where}: uzel „${node.id}“ potřebuje alespoň 2 možnosti`);
      if (!node.options.some((o) => o.verdict === 'good')) errors.push(`${where}: uzel „${node.id}“ nemá žádnou správnou možnost`);
      if (node.timeLimitSec !== undefined && !node.timeout) errors.push(`${where}: uzel „${node.id}“ má časový limit, ale chybí timeout`);
      for (const target of [...node.options.map((o) => o.next), ...(node.timeout ? [node.timeout.next] : [])]) {
        if (!nodes.has(target)) errors.push(`${where}: uzel „${node.id}“ vede do neznámého uzlu „${target}“`);
      }
    }
    const reached = new Set<string>();
    const visit = (nodeId: string) => {
      const node = nodes.get(nodeId);
      if (!node || reached.has(nodeId)) return;
      reached.add(nodeId);
      node.options.forEach((o) => visit(o.next));
      if (node.timeout) visit(node.timeout.next);
    };
    visit(scenario.start);
    for (const node of scenario.nodes) if (!reached.has(node.id)) errors.push(`${where}: uzel „${node.id}“ je nedosažitelný`);
    // Cesta samých správných rozhodnutí musí skončit úspěchem a s plynem v lahvi.
    let cursor = nodes.get(scenario.start);
    let gas = scenario.setup.startBar;
    for (let step = 0; cursor && !cursor.end && step < 100; step++) {
      const good = cursor.options.find((o) => o.verdict === 'good');
      if (!good) break;
      gas -= (callContentFunction('sacBarPerMinute', [scenario.setup.sacLpm * good.stress, scenario.setup.depthM, scenario.setup.tankLiters]) as number) * good.minutes;
      cursor = nodes.get(good.next);
    }
    if (cursor?.end?.outcome !== 'success') errors.push(`${where}: cesta správných rozhodnutí nekončí úspěchem`);
    else if (gas <= 0) errors.push(`${where}: na cestě správných rozhodnutí dojde plyn`);
  }

  // Pokrytí – vynucuje se jen u publikovaných modulů
  const published = new Set(modules.filter((m) => m.status === 'published').map((m) => m.id));
  const moduleOfQuestion = (conceptIdsOfQuestion: string[]) =>
    new Set(conceptIdsOfQuestion.map((cid) => concepts.find((c) => c.id === cid)?.moduleId).filter(Boolean) as string[]);
  for (const module of modules) {
    const report = (message: string) => (published.has(module.id) ? errors : warnings).push(`modul ${module.id}: ${message}`);
    const count = questions.filter((q) => moduleOfQuestion(q.conceptIds).has(module.id)).length;
    if (count < MIN_QUESTIONS_PER_MODULE) report(`má ${count} otázek, potřebuje alespoň ${MIN_QUESTIONS_PER_MODULE}`);
    if (!lessons.some((l) => l.moduleId === module.id)) report('nemá žádnou lekci');
    for (const concept of concepts.filter((c) => c.moduleId === module.id)) {
      const inLessons = lessons.filter((l) => l.conceptIds.includes(concept.id)).length;
      if (inLessons < 1) report(`uzel ${concept.id} není v žádné lekci`);
      const asked = questions.filter((q) => q.conceptIds.includes(concept.id)).length;
      if (asked < MIN_QUESTIONS_PER_CONCEPT) report(`uzel ${concept.id} má ${asked} otázek, potřebuje alespoň ${MIN_QUESTIONS_PER_CONCEPT}`);
    }
  }

  // Doplnění lessonIds u uzlů z lekcí (jeden směr se píše ručně, druhý se odvodí)
  const conceptsWithLessons = concepts.map((concept) => ({
    ...concept,
    lessonIds: [...new Set([...concept.lessonIds, ...lessons.filter((l) => l.conceptIds.includes(concept.id)).map((l) => l.id)])],
  }));

  const content: Content = {
    modules: [...modules].sort((a, b) => a.order - b.order),
    lessons: lessons.map(({ raw: _raw, ...lesson }) => lesson).sort((a, b) => a.order - b.order),
    concepts: conceptsWithLessons,
    relations,
    formulas,
    questions,
    cases,
    scenarios,
    facts,
    glossary,
    media,
  };
  return { errors, warnings, content };
}

/** Seznam míst čekajících na odbornou kontrolu → REVIEW.md. */
export function reviewItems(content: Content): string[] {
  return [
    ...content.lessons.filter((l) => l.needs_review).map((l) => `Lekce **${l.title}** (\`${l.id}\`, modul \`${l.moduleId}\`)`),
    ...content.questions.filter((q) => q.needs_review).map((q) => `Otázka \`${q.id}\`: ${q.prompt}`),
    ...content.scenarios.filter((s) => s.needs_review).map((s) => `Scénář **${s.title}** (\`${s.id}\`)`),
    ...content.cases.filter((c) => c.needs_review).map((c) => `Případová studie **${c.title}** (\`${c.id}\`, jistota: ${c.certainty})`),
    ...content.facts.filter((f) => f.needs_review).map((f) => `Zajímavost \`${f.id}\`: ${f.text}`),
  ];
}
