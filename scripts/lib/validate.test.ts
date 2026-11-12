import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LESSON_SECTIONS } from '../../src/content/schema';
import { loadContent, parseLessonMdx } from './load';
import { type RawContent, reviewItems, templateCorners, validateContent } from './validate';

const source = { title: 'NOAA Diving Manual' };

/** Minimální platný obsah; testy z něj odvozují chybné varianty. */
function valid(): RawContent {
  const question = (id: string) => ({
    id,
    type: 'choice',
    conceptIds: ['hloubka', 'tlak'],
    difficulty: 1,
    prompt: 'Otázka?',
    explanation: 'Protože.',
    options: [
      { text: 'ano', correct: true },
      { text: 'ne', explanation: 'Špatně, protože…' },
    ],
  });
  return {
    modules: [{ path: 'modules/m/module.yaml', data: { id: 'm', title: 'Modul', branch: 'depth', order: 0 } }],
    lessons: [
      {
        path: 'modules/m/lessons/l/lesson.mdx',
        meta: {
          id: 'l',
          moduleId: 'm',
          title: 'Lekce',
          order: 1,
          conceptIds: ['hloubka', 'tlak'],
          checkQuestionIds: ['q1', 'q2', 'q3'],
          estimatedMinutes: 5,
          audioSummary: 'Shrnutí.',
          sources: [source],
        },
        topLevelElements: [...LESSON_SECTIONS],
        calcCalls: [{ element: 'Worked', fn: 'absPressure', args: [30], expected: 4, tolerance: 0.001, steps: 'absPressureSteps' }],
      },
    ],
    concepts: [
      { id: 'hloubka', label: 'Hloubka', type: 'quantity', shortDefinition: 'x', moduleId: 'm' },
      { id: 'tlak', label: 'Tlak', type: 'quantity', shortDefinition: 'x', moduleId: 'm', formulaId: 'p-abs' },
    ],
    relations: [
      { from: 'hloubka', to: 'tlak', type: 'zvysuje', explanation: 'x', lessonId: 'l' },
      { from: 'tlak', to: 'hloubka', type: 'pocita_se_z', explanation: 'x', lessonId: 'l' },
    ],
    formulas: [{ id: 'p-abs', title: 'Tlak', latex: 'P', variables: [{ symbol: 'd', name: 'hloubka', unit: 'm' }], calcFunction: 'absPressure' }],
    questions: ['q1', 'q2', 'q3'].map((id) => ({ path: `q.yaml[${id}]`, data: question(id) })),
    cases: [],
    facts: [],
    glossary: [],
    media: [],
  };
}

const errorsOf = (mutate: (raw: RawContent) => void) => {
  const raw = valid();
  mutate(raw);
  return validateContent(raw).errors.join('\n');
};
const meta = (raw: RawContent) => raw.lessons[0]!.meta as Record<string, unknown>;
const q = (raw: RawContent, i = 0) => raw.questions[i]!.data as Record<string, unknown>;

describe('validátor obsahu', () => {
  it('platný obsah projde bez chyb; rozpracovaný modul dává jen varování', () => {
    const result = validateContent(valid());
    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toMatch(/má 3 otázek, potřebuje alespoň 40/);
    expect(result.content.concepts.find((c) => c.id === 'hloubka')?.lessonIds).toEqual(['l']);
  });

  it('publikovaný modul bez pokrytí je chyba', () => {
    const errors = errorsOf((raw) => Object.assign(raw.modules[0]!.data as object, { status: 'published' }));
    expect(errors).toMatch(/modul m: má 3 otázek/);
  });

  it('publikovaný modul: uzel bez lekce a s méně než 3 otázkami', () => {
    const errors = errorsOf((raw) => {
      Object.assign(raw.modules[0]!.data as object, { status: 'published' });
      raw.concepts.push({ id: 'sirotek', label: 'Sirotek', type: 'risk', shortDefinition: 'x', moduleId: 'm' });
    });
    expect(errors).toMatch(/uzel sirotek není v žádné lekci/);
    expect(errors).toMatch(/uzel sirotek má 0 otázek/);
  });

  it('chyba schématu uvede soubor a pole', () => {
    expect(errorsOf((raw) => delete meta(raw).title)).toMatch(/lesson\.mdx: title/);
    expect(errorsOf((raw) => Object.assign(raw.modules[0]!.data as object, { branch: 'vesmir' }))).toMatch(/module\.yaml: branch/);
  });

  it('chybějící, zdvojená a přeházená sekce šablony', () => {
    expect(errorsOf((raw) => { raw.lessons[0]!.topLevelElements = LESSON_SECTIONS.filter((s) => s !== 'RealWorld'); })).toMatch(/chybí sekce <RealWorld>/);
    expect(errorsOf((raw) => raw.lessons[0]!.topLevelElements.push('Hook'))).toMatch(/sekce <Hook> je v lekci 2×/);
    expect(errorsOf((raw) => { raw.lessons[0]!.topLevelElements = [...LESSON_SECTIONS].reverse(); })).toMatch(/nejsou v pořadí šablony/);
  });

  it('lekce potřebuje alespoň 2 vazby do grafu', () => {
    expect(errorsOf((raw) => raw.relations.pop())).toMatch(/má 1 vazeb do grafu/);
  });

  it('neznámé reference', () => {
    expect(errorsOf((raw) => { meta(raw).moduleId = 'x'; })).toMatch(/neznámý modul „x“/);
    expect(errorsOf((raw) => { meta(raw).conceptIds = ['nic']; })).toMatch(/neznámý uzel „nic“/);
    expect(errorsOf((raw) => { meta(raw).checkQuestionIds = ['q1', 'q2', 'q9']; })).toMatch(/neznámá otázka „q9“/);
    expect(errorsOf((raw) => { q(raw).backToLessonId = 'x'; })).toMatch(/neznámá lekce „x“ v backToLessonId/);
    expect(errorsOf((raw) => Object.assign(raw.relations[0] as object, { to: 'nic' }))).toMatch(/neznámý uzel „nic“/);
    expect(errorsOf((raw) => Object.assign(raw.relations[0] as object, { lessonId: 'x' }))).toMatch(/neznámá lekce „x“/);
    expect(errorsOf((raw) => Object.assign(raw.concepts[1] as object, { formulaId: 'x' }))).toMatch(/neznámý vzorec „x“/);
    expect(errorsOf((raw) => Object.assign(raw.concepts[0] as object, { lessonIds: ['x'] }))).toMatch(/neznámá lekce „x“/);
    expect(errorsOf((raw) => Object.assign(raw.modules[0]!.data as object, { prerequisites: ['x'] }))).toMatch(/neznámá prerekvizita/);
    expect(errorsOf((raw) => Object.assign(raw.modules[0]!.data as object, { unlockAfter: 'x' }))).toMatch(/unlockAfter/);
  });

  it('duplicitní id a vazby, smyčka na sebe, cyklus prerekvizit', () => {
    expect(errorsOf((raw) => raw.questions.push(raw.questions[0]!))).toMatch(/duplicitní id \(otázka\): q1/);
    expect(errorsOf((raw) => raw.relations.push(raw.relations[0]))).toMatch(/duplicitní vazba/);
    expect(errorsOf((raw) => Object.assign(raw.relations[0] as object, { to: 'hloubka' }))).toMatch(/sám na sebe/);
    expect(
      errorsOf((raw) => {
        Object.assign(raw.modules[0]!.data as object, { prerequisites: ['n'] });
        raw.modules.push({ path: 'n', data: { id: 'n', title: 'N', branch: 'depth', order: 1, prerequisites: ['m'] } });
      }),
    ).toMatch(/cyklus/);
  });

  it('vzorec a <Calc>/<Worked> musí mířit na existující funkci calc', () => {
    expect(errorsOf((raw) => Object.assign(raw.formulas[0] as object, { calcFunction: 'neni' }))).toMatch(/„neni“ není v @diveedu\/calc/);
    expect(errorsOf((raw) => { raw.lessons[0]!.calcCalls[0]!.fn = 'neni'; })).toMatch(/neznámou funkci calc „neni“/);
    expect(errorsOf((raw) => { raw.lessons[0]!.calcCalls[0]!.steps = 'neni'; })).toMatch(/neznámá funkce postupu/);
    expect(errorsOf((raw) => { raw.lessons[0]!.calcCalls[0]!.args = 30; })).toMatch(/args musí být pole/);
  });

  it('řešený příklad se kontroluje proti ručně spočtené referenci', () => {
    expect(errorsOf((raw) => { raw.lessons[0]!.calcCalls[0]!.expected = 3; })).toMatch(/calc vrací 4, ručně spočtená reference je 3/);
    expect(errorsOf((raw) => { delete raw.lessons[0]!.calcCalls[0]!.expected; })).toMatch(/chybí číselné expected a tolerance/);
    expect(errorsOf((raw) => { raw.lessons[0]!.calcCalls[0]!.args = [-5]; })).toMatch(/výpočet selhal/);
  });

  it('výběrové otázky: právě jedna správná a vysvětlení u špatných', () => {
    expect(errorsOf((raw) => { q(raw).options = [{ text: 'a', explanation: 'x' }, { text: 'b', explanation: 'x' }]; })).toMatch(/právě jedna možnost musí být správná \(je 0\)/);
    expect(errorsOf((raw) => { q(raw).options = [{ text: 'a', correct: true }, { text: 'b' }]; })).toMatch(/špatná možnost #2 nemá vysvětlení/);
    expect(errorsOf((raw) => { Object.assign(q(raw), { type: 'multi', options: [{ text: 'a', explanation: 'x' }, { text: 'b', explanation: 'x' }] }); })).toMatch(/alespoň jedna/);
  });

  it('numerická šablona: funkce, parametry, prompt a krajní hodnoty', () => {
    const numeric = (template: Record<string, unknown>, prompt = 'Tlak v {depth} m?') => (raw: RawContent) => {
      raw.questions[0]!.data = { id: 'q1', type: 'numeric', conceptIds: ['tlak'], difficulty: 1, prompt, explanation: 'x', template: { fn: 'absPressure', params: { depth: { min: 0, max: 60, step: 1 } }, args: ['depth'], tolerance: 0.05, unit: 'bar', ...template } };
    };
    expect(errorsOf(numeric({}))).toBe('');
    expect(errorsOf(numeric({ fn: 'neni' }))).toMatch(/„neni“ není v @diveedu\/calc/);
    expect(errorsOf(numeric({ args: ['hloubka'] }))).toMatch(/argument „hloubka“ nemá definici/);
    expect(errorsOf(numeric({}, 'Tlak?'))).toMatch(/prompt neobsahuje \{depth\}/);
    expect(errorsOf(numeric({ params: { depth: { min: -10, max: 60, step: 1 } } }))).toMatch(/výpočet selhal/);
    expect(errorsOf(numeric({ params: { depth: { min: 60, max: 10, step: 1 } } }))).toMatch(/min > max/);
    expect(errorsOf(numeric({ fn: 'cnsLimitMinutes', params: { depth: { values: [1.8] } } }))).toMatch(/nevrací konečné číslo/);
  });

  it('najdi chybu: musí mít chybu s vysvětlením', () => {
    const findError = (items: unknown[]) => (raw: RawContent) => { raw.questions[0]!.data = { id: 'q1', type: 'findError', conceptIds: ['tlak'], difficulty: 1, prompt: 'x', explanation: 'x', items }; };
    expect(errorsOf(findError([{ text: 'a' }, { text: 'b' }]))).toMatch(/žádná položka není označená jako chyba/);
    expect(errorsOf(findError([{ text: 'a', isError: true }, { text: 'b' }]))).toMatch(/chyba #1 nemá vysvětlení/);
  });

  it('případová studie a zajímavost kontrolují reference', () => {
    const errors = errorsOf((raw) => {
      raw.cases.push({ path: 'cases/c.yaml', data: { id: 'c', title: 'C', location: 'X', moduleIds: ['x'], context: 'x', timeline: [{ when: 'a', what: 'b' }], errorChain: [{ layer: 'plyn', description: 'x', conceptIds: ['nic'] }], physiology: 'x', calcTasks: [{ prompt: 'x', fn: 'neni', args: [], unit: 'm', tolerance: 1 }], preventions: ['x'], sources: [source], certainty: 'hypotéza' } });
      raw.facts.push({ id: 'f', text: 'x', conceptIds: ['nic'], image: 'obrazek', source });
    });
    expect(errors).toMatch(/případová studie c: neznámý modul „x“/);
    expect(errors).toMatch(/případová studie c: neznámý uzel „nic“/);
    expect(errors).toMatch(/případová studie c: funkce „neni“/);
    expect(errors).toMatch(/zajímavost f: neznámý uzel „nic“/);
    expect(errors).toMatch(/zajímavost f: neznámé médium/);
  });

  it('případová studie bez zdrojů nebo bez označení jistoty neprojde', () => {
    const study = { id: 'c', title: 'C', location: 'X', moduleIds: ['m'], context: 'x', timeline: [{ when: 'a', what: 'b' }], errorChain: [{ layer: 'plyn', description: 'x' }], physiology: 'x', preventions: ['x'] };
    expect(errorsOf((raw) => raw.cases.push({ path: 'cases/c.yaml', data: { ...study, sources: [], certainty: 'hypotéza' } }))).toMatch(/sources/);
    expect(errorsOf((raw) => raw.cases.push({ path: 'cases/c.yaml', data: { ...study, sources: [source] } }))).toMatch(/certainty/);
  });

  it('REVIEW seznam obsahuje vše s needs_review', () => {
    const raw = valid();
    meta(raw).needs_review = true;
    q(raw).needs_review = true;
    raw.facts.push({ id: 'f', text: 'Fakt', source, needs_review: true });
    raw.cases.push({ path: 'c', data: { id: 'c', title: 'Případ', location: 'X', moduleIds: ['m'], context: 'x', timeline: [{ when: 'a', what: 'b' }], errorChain: [{ layer: 'plyn', description: 'x' }], physiology: 'x', preventions: ['x'], sources: [source], certainty: 'hypotéza' } });
    const items = reviewItems(validateContent(raw).content);
    expect(items).toHaveLength(4);
    expect(items.join('\n')).toMatch(/Lekce \*\*Lekce\*\*[\s\S]*Otázka `q1`[\s\S]*Případ[\s\S]*Zajímavost `f`/);
  });

  it('krajní kombinace parametrů šablony', () => {
    expect(templateCorners({ fn: 'x', params: { a: { min: 1, max: 2, step: 1 }, b: { values: [5, 6, 7] }, c: { values: [9] } }, args: ['a'], tolerance: 0, unit: '', decimals: 1 })).toHaveLength(4);
  });
});

describe('MDX lekce', () => {
  it('najde sekce nejvyšší úrovně a volání calc včetně vnořených', () => {
    const parsed = parseLessonMdx(
      ['<Hook>', '', 'Text s <Calc fn="absPressure" args={[30]} unit="bar" /> uvnitř.', '', '</Hook>', '', '<WorkedSection>', '', '<Worked fn="mod" args={[0.32, 1.4]} expected={33.75} tolerance={0.01} />', '', '</WorkedSection>'].join('\n'),
    );
    expect(parsed.topLevelElements).toEqual(['Hook', 'WorkedSection']);
    expect(parsed.calcCalls).toEqual([
      { element: 'Calc', fn: 'absPressure', args: [30], unit: 'bar' },
      { element: 'Worked', fn: 'mod', args: [0.32, 1.4], expected: 33.75, tolerance: 0.01 },
    ]);
  });
});

describe('skutečný obsah v /content', () => {
  it('projde validací bez chyb', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../content');
    const result = validateContent(loadContent(root));
    expect(result.errors).toEqual([]);
    expect(result.content.lessons.length).toBeGreaterThan(0);
  });
});
