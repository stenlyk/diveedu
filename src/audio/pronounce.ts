/**
 * Slovník výslovnosti pro hlasový výstup: zkratky a značky, které by syntéza komolila.
 * Čistá funkce; používá ji generátor zvuku i náhradní čtení systémovým hlasem v prohlížeči.
 */

/** Zkratky čtené po písmenech nebo zavedeným slovem. Klíč se hledá jako celé slovo, s ohledem na velikost písmen. */
export const ABBREVIATIONS: Readonly<Record<string, string>> = {
  MOD: 'em ó dé',
  END: 'é en dé',
  EAD: 'é á dé',
  CNS: 'cé en es',
  OTU: 'ó té ú',
  GF: 'gé ef',
  SAC: 'sak',
  RMV: 'er em vé',
  NDL: 'en dé el',
  DCS: 'dé cé es',
  ICD: 'í cé dé',
  HPNS: 'há pé en es',
  DPV: 'dé pé vé',
  REM: 'rem',
  OC: 'ó cé',
  CCR: 'cé cé er',
  ZHL: 'zet há el',
  NOAA: 'noa',
  NEDU: 'nedu',
  TDI: 'té dé í',
  GUE: 'gé ú é',
  IANTD: 'í á en té dé',
  NSS: 'en es es',
  DAN: 'dan',
  VPM: 'vé pé em',
  PWA: 'pé vé á',
  DIN: 'dín',
  PFO: 'pé ef ó',
  IPE: 'í pé é',
  AGE: 'á gé é',
  ppO2: 'pé pé ó dva',
  ppN2: 'pé pé en dva',
  ppHe: 'pé pé helia',
  CO2: 'cé ó dva',
  O2: 'ó dva',
  N2: 'en dva',
  He: 'helium',
  fO2: 'frakce kyslíku',
  fHe: 'frakce helia',
};

const UNITS: readonly [RegExp, string][] = [
  [/\bm\/min\b/g, 'metrů za minutu'],
  [/\bl\/min\b/g, 'litrů za minutu'],
  [/\bg\/l\b/g, 'gramů na litr'],
  [/\bbar\/min\b/g, 'barů za minutu'],
];

const CS_NUMBER = '(\\d{1,3})';

/** Přepíše text tak, aby ho český hlas přečetl srozumitelně. */
export function toSpeech(text: string): string {
  let out = text;
  // Směsi: „EAN50“ → „nitrox 50“, „Tx 18/45“ → „trimix 18 45“, „GF 30/85“ → „gé ef 30 85“.
  out = out.replace(new RegExp(`\\bEAN\\s?${CS_NUMBER}\\b`, 'g'), 'nitrox $1');
  out = out.replace(new RegExp(`\\bTx\\s?${CS_NUMBER}/${CS_NUMBER}\\b`, 'g'), 'trimix $1 $2');
  out = out.replace(new RegExp(`\\bGF\\s?${CS_NUMBER}/${CS_NUMBER}\\b`, 'g'), 'gé ef $1 $2');
  out = out.replace(/\bZHL-16C\b/g, 'zet há el šestnáct cé');
  for (const [pattern, spoken] of UNITS) out = out.replace(pattern, spoken);
  out = out.replace(/[A-Za-z][A-Za-z0-9]*/g, (word) => ABBREVIATIONS[word] ?? word);
  // Znaky, které hlas čte doslova nebo přeskakuje s pauzou na špatném místě.
  out = out.replace(/[„“”"]/g, '').replace(/\s[–—]\s/g, ', ').replace(/×/g, ' krát ').replace(/≥/g, ' nejméně ').replace(/≤/g, ' nejvýše ');
  return out.replace(/\s+/g, ' ').replace(/\s([,.;:!?])/g, '$1').trim();
}

/**
 * Zkratky, které slovník nezná: slova ze dvou a více velkých písmen nebo písmen s číslicí.
 * Validátor obsahu podle toho odmítne shrnutí, které by hlas zkomolil.
 */
export function unknownAbbreviations(text: string): string[] {
  const spoken = toSpeech(text);
  const found = spoken.match(/\b(?:[A-Z]{2,}[A-Za-z0-9]*|[A-Za-z]+\d[A-Za-z0-9]*)\b/g) ?? [];
  return [...new Set(found)];
}

/** Text, který se čte u lekce: název a shrnutí. */
export function lessonSpeech(lesson: { title: string; audioSummary: string }): string {
  return `${toSpeech(lesson.title)}. ${toSpeech(lesson.audioSummary)}`;
}
