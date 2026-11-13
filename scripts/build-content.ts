/**
 * Validuje /content a zapíše zkompilovaný obsah pro aplikaci + REVIEW.md.
 * Chyba v obsahu ukončí proces s kódem 1 (zastaví build).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIMATIONS } from '../src/anim/defs';
import { parseManifest } from '../src/audio/manifest';
import { lessonSpeech, toSpeech } from '../src/audio/pronounce';
import { loadContent } from './lib/load';
import { reviewItems, validateContent } from './lib/validate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { errors, warnings, content } = validateContent(loadContent(join(root, 'content')));

for (const warning of warnings) console.warn(`⚠ ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`✗ ${error}`);
  console.error(`\nObsah má ${errors.length} chyb. Build zastaven.`);
  process.exit(1);
}

const outDir = join(root, 'src/content/generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'content.json'), JSON.stringify(content));

// Aplikace manifest zvuku vždy načítá; bez vygenerovaného zvuku (npm run tts) dostane prázdný a čte systémovým hlasem.
const manifestPath = join(root, 'public/media-manifest.json');
if (!existsSync(manifestPath)) writeFileSync(manifestPath, JSON.stringify({ voice: '', generatedAt: '', files: [], animations: [] }));

// Zvuk je uložený v gitu; po změně textu shrnutí nebo výkladu zastará. Build kvůli tomu nepadá, jen to řekne.
const audio = parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
if (audio.voice) {
  const fingerprint = (text: string) => createHash('sha256').update(`${audio.voice}\n${text}`).digest('hex').slice(0, 16);
  const recorded = new Map(audio.files.map((file) => [file.lessonId, file.hash]));
  const staleLessons = content.lessons.filter((lesson) => recorded.get(lesson.id) !== fingerprint(lessonSpeech(lesson))).map((lesson) => lesson.id);
  const recordedAnimations = new Map(audio.animations.map((item) => [item.id, item.hash]));
  const staleAnimations = ANIMATIONS.filter((animation) => recordedAnimations.get(animation.id) !== fingerprint(animation.cues.map(toSpeech).join(' '))).map((animation) => animation.id);
  const stale = [...staleLessons, ...staleAnimations];
  if (stale.length > 0) console.warn(`⚠ Nahraný zvuk neodpovídá textu u ${stale.length} položek (${stale.slice(0, 5).join(', ')}${stale.length > 5 ? ', …' : ''}). Spusť „npm run tts“ a nové soubory commitni.`);
}

const items = reviewItems(content);
const review = [
  '# REVIEW.md – místa čekající na odbornou kontrolu',
  '',
  'Generováno skriptem `npm run content` z polí `needs_review: true`. Needituj ručně.',
  'Ruční poznámky ke konvencím ve výpočtech jsou v `docs/REVIEW-calc.md`.',
  '',
  items.length === 0 ? '_Žádná položka._' : items.map((item) => `- [ ] ${item}`).join('\n'),
  '',
].join('\n');
writeFileSync(join(root, 'REVIEW.md'), review);

console.log(
  `✓ Obsah v pořádku: ${content.modules.length} modulů, ${content.lessons.length} lekcí, ${content.questions.length} otázek, ` +
    `${content.concepts.length} uzlů, ${content.relations.length} vazeb. K odborné kontrole: ${items.length}.`,
);
