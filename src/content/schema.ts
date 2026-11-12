/**
 * Schémata obsahu (Zod). Jediný zdroj pravdy pro tvar dat v /content –
 * používá je validátor při buildu i aplikace za běhu.
 */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id: jen malá písmena, číslice a pomlčky');

export const SourceSchema = z.object({
  title: z.string().min(1),
  author: z.string().optional(),
  year: z.number().int().optional(),
  url: z.url().optional(),
  note: z.string().optional(),
});

export const BRANCHES = ['depth', 'cave', 'cross'] as const;
export const RIGS = ['oc', 'ccr'] as const;

export const ModuleSchema = z.object({
  id,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  branch: z.enum(BRANCHES),
  rig: z.enum(RIGS).default('oc'),
  prerequisites: z.array(id).default([]),
  order: z.number(),
  passThreshold: z.number().min(0).max(1).default(0.8),
  /** U průřezových modulů: po kterém modulu hlavní linie se odemykají. */
  unlockAfter: id.optional(),
  /** draft = rozpracovaný modul; pravidla pokrytí se vynucují jen pro published. */
  status: z.enum(['draft', 'published']).default('draft'),
});

export const LESSON_SECTIONS = [
  'Hook',
  'Principle',
  'FormulaSection',
  'WorkedSection',
  'PlaygroundSection',
  'Links',
  'RealWorld',
  'Check',
  'AudioSummary',
] as const;

export const SECTION_TITLES: Record<(typeof LESSON_SECTIONS)[number], string> = {
  Hook: 'Háček',
  Principle: 'Princip',
  FormulaSection: 'Vzorec a odvození',
  WorkedSection: 'Ukázkový výpočet',
  PlaygroundSection: 'Vyzkoušej si',
  Links: 'Souvislosti',
  RealWorld: 'Ze skutečnosti',
  Check: 'Ověření',
  AudioSummary: 'Shrnutí',
};

export const LessonSchema = z.object({
  id,
  moduleId: id,
  title: z.string().min(1),
  order: z.number(),
  conceptIds: z.array(id).min(1),
  checkQuestionIds: z.array(id).min(3).max(6),
  estimatedMinutes: z.number().positive(),
  audioSummary: z.string().min(1),
  sources: z.array(SourceSchema).min(1),
  needs_review: z.boolean().default(false),
});

export const CONCEPT_TYPES = [
  'quantity',
  'gas',
  'physiology',
  'procedure',
  'equipment',
  'risk',
  'formula',
] as const;

export const CONCEPT_TYPE_LABELS: Record<(typeof CONCEPT_TYPES)[number], string> = {
  quantity: 'Fyzikální veličina',
  gas: 'Plyn a směs',
  physiology: 'Fyziologický jev',
  procedure: 'Postup',
  equipment: 'Vybavení',
  risk: 'Riziko',
  formula: 'Vzorec',
};

export const ConceptSchema = z.object({
  id,
  label: z.string().min(1),
  type: z.enum(CONCEPT_TYPES),
  shortDefinition: z.string().min(1),
  moduleId: id,
  lessonIds: z.array(id).default([]),
  formulaId: id.optional(),
});

export const RELATION_TYPES = [
  'zvysuje',
  'snizuje',
  'zpusobuje',
  'zhorsuje',
  'zmirnuje',
  'pocita_se_z',
  'je_predpokladem',
  'vedlo_k',
] as const;

export const RELATION_LABELS: Record<(typeof RELATION_TYPES)[number], string> = {
  zvysuje: 'zvyšuje',
  snizuje: 'snižuje',
  zpusobuje: 'způsobuje',
  zhorsuje: 'zhoršuje',
  zmirnuje: 'zmírňuje',
  pocita_se_z: 'počítá se z',
  je_predpokladem: 'je předpokladem',
  vedlo_k: 'vedlo k',
};

export const RelationSchema = z.object({
  from: id,
  to: id,
  type: z.enum(RELATION_TYPES),
  explanation: z.string().min(1),
  lessonId: id,
});

export const FormulaSchema = z.object({
  id,
  title: z.string().min(1),
  latex: z.string().min(1),
  variables: z.array(z.object({ symbol: z.string(), name: z.string(), unit: z.string() })).min(1),
  /** Název exportované funkce v @diveedu/calc. */
  calcFunction: z.string().min(1),
});

const questionBase = {
  id,
  conceptIds: z.array(id).min(1).max(3),
  difficulty: z.number().int().min(1).max(5),
  prompt: z.string().min(1),
  explanation: z.string().min(1),
  /** Lekce, na kterou vede chybná odpověď. */
  backToLessonId: id.optional(),
  sources: z.array(SourceSchema).default([]),
  needs_review: z.boolean().default(false),
};

const OptionSchema = z.object({
  text: z.string().min(1),
  correct: z.boolean().default(false),
  /** Proč je možnost správně/špatně. U špatných možností povinné. */
  explanation: z.string().optional(),
});

const ParamSchema = z.union([
  z.object({ min: z.number(), max: z.number(), step: z.number().positive() }),
  z.object({ values: z.array(z.number()).min(1) }),
]);

export const NumericTemplateSchema = z.object({
  /** Funkce v @diveedu/calc, která spočítá správný výsledek. */
  fn: z.string().min(1),
  /** Náhodné vstupy; v promptu se na ně odkazuje jako {jmeno}. */
  params: z.record(z.string(), ParamSchema),
  /** Pevné vstupy, které se nelosují a v zadání se nezmiňují (např. cílová hloubka 0 m). */
  fixed: z.record(z.string(), z.number()).default({}),
  /** Pořadí parametrů při volání funkce. */
  args: z.array(z.string()).min(1),
  tolerance: z.number().nonnegative(),
  unit: z.string(),
  decimals: z.number().int().min(0).max(4).default(1),
});

export const QuestionSchema = z.discriminatedUnion('type', [
  z.object({ ...questionBase, type: z.literal('choice'), options: z.array(OptionSchema).min(2) }),
  z.object({ ...questionBase, type: z.literal('multi'), options: z.array(OptionSchema).min(2) }),
  /** Proč / co kdyby – výběr příčiny nebo důsledku; ověřuje vazbu grafu. */
  z.object({ ...questionBase, type: z.literal('why'), options: z.array(OptionSchema).min(2) }),
  z.object({ ...questionBase, type: z.literal('numeric'), template: NumericTemplateSchema }),
  /** Seřaď – items jsou zapsané ve správném pořadí. */
  z.object({ ...questionBase, type: z.literal('order'), items: z.array(z.string().min(1)).min(3) }),
  z.object({
    ...questionBase,
    type: z.literal('match'),
    pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).min(2),
  }),
  z.object({
    ...questionBase,
    type: z.literal('findError'),
    items: z
      .array(z.object({ text: z.string().min(1), isError: z.boolean().default(false), explanation: z.string().optional() }))
      .min(2),
  }),
]);

export const CaseStudySchema = z.object({
  id,
  title: z.string().min(1),
  year: z.number().int().optional(),
  location: z.string().min(1),
  rig: z.enum(RIGS).default('oc'),
  moduleIds: z.array(id).min(1),
  anonymized: z.boolean().default(false),
  context: z.string().min(1),
  profile: z.array(z.object({ minute: z.number(), depthM: z.number(), event: z.string().optional() })).default([]),
  timeline: z.array(z.object({ when: z.string(), what: z.string() })).min(1),
  errorChain: z
    .array(
      z.object({
        layer: z.enum(['planovani', 'plyn', 'vybaveni', 'prostredi', 'lidsky-faktor']),
        description: z.string().min(1),
        conceptIds: z.array(id).default([]),
      }),
    )
    .min(1),
  physiology: z.string().min(1),
  calcTasks: z.array(z.object({ prompt: z.string(), fn: z.string(), args: z.array(z.unknown()), unit: z.string(), tolerance: z.number() })).default([]),
  preventions: z.array(z.string().min(1)).min(1),
  sources: z.array(SourceSchema).min(1),
  certainty: z.enum(['doloženo', 'hypotéza']),
  needs_review: z.boolean().default(true),
});

export const FactSchema = z.object({
  id,
  text: z.string().min(1),
  image: id.optional(),
  conceptIds: z.array(id).default([]),
  source: SourceSchema,
  needs_review: z.boolean().default(false),
});

export const GlossaryTermSchema = z.object({
  cs: z.string().min(1),
  en: z.string().min(1),
  definition: z.string().min(1),
  /** Jak má termín číst TTS (např. „em-ó-dé“). */
  pronunciation: z.string().optional(),
});

export const MediaSchema = z.object({
  id,
  kind: z.enum(['image', 'audio', 'video', 'animation']),
  file: z.string().min(1),
  caption: z.string().optional(),
  credit: z.string().min(1),
  license: z.string().min(1),
});

export type Source = z.infer<typeof SourceSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Concept = z.infer<typeof ConceptSchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type Formula = z.infer<typeof FormulaSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type NumericTemplate = z.infer<typeof NumericTemplateSchema>;
export type CaseStudy = z.infer<typeof CaseStudySchema>;
export type Fact = z.infer<typeof FactSchema>;
export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;
export type Media = z.infer<typeof MediaSchema>;

/** Zkompilovaný obsah, jak ho dostane aplikace. */
export interface Content {
  modules: Module[];
  lessons: (Lesson & { path: string })[];
  concepts: Concept[];
  relations: Relation[];
  formulas: Formula[];
  questions: Question[];
  cases: CaseStudy[];
  facts: Fact[];
  glossary: GlossaryTerm[];
  media: Media[];
}
