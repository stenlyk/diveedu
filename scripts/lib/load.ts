/** Načtení /content z disku do RawContent. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parse as parseYaml } from 'yaml';
import type { CalcCall, RawContent, RawLesson } from './validate';

interface MdxNode {
  type: string;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: MdxNode[];
}

const yamlFile = (file: string): unknown => parseYaml(readFileSync(file, 'utf8'));
const yamlList = (file: string): unknown[] => {
  if (!existsSync(file)) return [];
  const data = yamlFile(file);
  if (data == null) return [];
  if (!Array.isArray(data)) throw new Error(`${file}: očekávám seznam`);
  return data;
};
const dirs = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort() : []);
const files = (dir: string, ext: string) => (existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(ext)).sort() : []);

/** Hodnota JSX atributu: řetězec, nebo vyhodnocený JS výraz (obsah je náš vlastní, důvěryhodný). */
function attributeValue(value: unknown): unknown {
  if (value == null) return true;
  if (typeof value === 'string') return value;
  const source = (value as { value: string }).value;
  return new Function(`return (${source});`)();
}

export function parseLessonMdx(source: string): Pick<RawLesson, 'topLevelElements' | 'calcCalls'> {
  const tree = unified().use(remarkParse).use(remarkMdx).parse(source) as MdxNode;
  const topLevelElements = (tree.children ?? [])
    .filter((node) => node.type === 'mdxJsxFlowElement' && node.name)
    .map((node) => node.name!);
  const calcCalls: CalcCall[] = [];
  const walk = (node: MdxNode) => {
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && (node.name === 'Calc' || node.name === 'Worked')) {
      const call: Record<string, unknown> = { element: node.name };
      for (const attribute of node.attributes ?? []) {
        if (attribute.type === 'mdxJsxAttribute' && attribute.name) call[attribute.name] = attributeValue(attribute.value);
      }
      calcCalls.push(call as unknown as CalcCall);
    }
    node.children?.forEach(walk);
  };
  walk(tree);
  return { topLevelElements, calcCalls };
}

export function loadContent(contentDir: string): RawContent {
  const raw: RawContent = {
    modules: [],
    lessons: [],
    concepts: yamlList(join(contentDir, 'graph/concepts.yaml')),
    relations: yamlList(join(contentDir, 'graph/relations.yaml')),
    formulas: yamlList(join(contentDir, 'formulas.yaml')),
    questions: [],
    cases: [],
    facts: yamlList(join(contentDir, 'facts.yaml')),
    glossary: yamlList(join(contentDir, 'glossary.yaml')),
    media: yamlList(join(contentDir, 'media.yaml')),
  };
  const modulesDir = join(contentDir, 'modules');
  for (const moduleDir of dirs(modulesDir)) {
    const base = join(modulesDir, moduleDir);
    raw.modules.push({ path: relative(contentDir, join(base, 'module.yaml')), data: yamlFile(join(base, 'module.yaml')) });
    for (const lessonDir of dirs(join(base, 'lessons'))) {
      const lessonBase = join(base, 'lessons', lessonDir);
      const mdxPath = join(lessonBase, 'lesson.mdx');
      raw.lessons.push({
        path: relative(contentDir, mdxPath),
        meta: yamlFile(join(lessonBase, 'lesson.yaml')),
        ...parseLessonMdx(readFileSync(mdxPath, 'utf8')),
      });
    }
    for (const file of files(join(base, 'questions'), '.yaml')) {
      const path = join(base, 'questions', file);
      yamlList(path).forEach((data, i) => raw.questions.push({ path: `${relative(contentDir, path)}[${i}]`, data }));
    }
  }
  for (const file of files(join(contentDir, 'cases'), '.yaml')) {
    const path = join(contentDir, 'cases', file);
    raw.cases.push({ path: relative(contentDir, path), data: yamlFile(path) });
  }
  return raw;
}
