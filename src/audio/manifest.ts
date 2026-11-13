/** Manifest předem vygenerovaného zvuku: které lekce mají soubor, jak je velký a ke kterému balíčku patří. */

export interface AudioFile {
  lessonId: string;
  /** Cesta relativní ke kořeni aplikace, např. media/nitrox/ppo2-a-mod.m4a. */
  file: string;
  bytes: number;
  seconds: number;
  /** Otisk čteného textu; generátor podle něj pozná, co je třeba přegenerovat. */
  hash: string;
}

/** Namluvený animovaný výklad: jeden soubor a začátky jednotlivých vět. */
export interface AnimationAudio {
  id: string;
  moduleId: string;
  file: string;
  bytes: number;
  seconds: number;
  hash: string;
  /** Začátek každé věty v sekundách; řídí kroky scény a titulky. */
  cues: number[];
}

export interface AudioManifest {
  /** Hlas a nástroj, kterým zvuk vznikl. */
  voice: string;
  generatedAt: string;
  files: AudioFile[];
  animations: AnimationAudio[];
}

export interface AudioPack {
  moduleId: string;
  files: AudioFile[];
  bytes: number;
  seconds: number;
}

export const EMPTY_MANIFEST: AudioManifest = { voice: '', generatedAt: '', files: [], animations: [] };

/** Balíčky po modulech, v pořadí modulů; moduly bez zvuku se vynechají. */
export function packsOf(manifest: AudioManifest, lessons: readonly { id: string; moduleId: string }[], moduleOrder: readonly string[]): AudioPack[] {
  const moduleOfLesson = new Map(lessons.map((lesson) => [lesson.id, lesson.moduleId]));
  const byModule = new Map<string, AudioFile[]>();
  for (const file of manifest.files) {
    const moduleId = moduleOfLesson.get(file.lessonId);
    if (!moduleId) continue;
    byModule.set(moduleId, [...(byModule.get(moduleId) ?? []), file]);
  }
  // Zvuk animovaných výkladů patří do balíčku svého modulu.
  for (const animation of manifest.animations) {
    const entry: AudioFile = { lessonId: `animace:${animation.id}`, file: animation.file, bytes: animation.bytes, seconds: animation.seconds, hash: animation.hash };
    byModule.set(animation.moduleId, [...(byModule.get(animation.moduleId) ?? []), entry]);
  }
  return moduleOrder.flatMap((moduleId) => {
    const files = byModule.get(moduleId);
    if (!files) return [];
    return [{ moduleId, files, bytes: files.reduce((sum, file) => sum + file.bytes, 0), seconds: files.reduce((sum, file) => sum + file.seconds, 0) }];
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

/** Ověří tvar manifestu staženého ze sítě; cokoli jiného se bere jako prázdný manifest. */
export function parseManifest(value: unknown): AudioManifest {
  if (typeof value !== 'object' || value === null) return EMPTY_MANIFEST;
  const raw = value as Partial<AudioManifest>;
  if (!Array.isArray(raw.files)) return EMPTY_MANIFEST;
  const files = raw.files.filter((file): file is AudioFile => typeof file?.lessonId === 'string' && typeof file.file === 'string' && typeof file.bytes === 'number' && typeof file.seconds === 'number');
  const animations = (Array.isArray(raw.animations) ? raw.animations : []).filter((item): item is AnimationAudio =>
    typeof item?.id === 'string' && typeof item.moduleId === 'string' && typeof item.file === 'string' && typeof item.bytes === 'number' && typeof item.seconds === 'number' && Array.isArray(item.cues) && item.cues.every((cue) => typeof cue === 'number'));
  return { voice: typeof raw.voice === 'string' ? raw.voice : '', generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : '', files, animations };
}

export const mediaUrl = (file: string): string => `${import.meta.env.BASE_URL}${file}`;

/**
 * Adresa nahrávky včetně otisku obsahu. Soubory mají stálá jména a service worker je drží v mezipaměti natrvalo;
 * bez otisku v adrese by po přegenerování hrál starou verzi.
 */
export const audioUrl = (entry: { file: string; hash: string }): string => `${mediaUrl(entry.file)}?v=${encodeURIComponent(entry.hash)}`;

let pending: Promise<AudioManifest> | null = null;

/** Manifest se načte jednou za běh aplikace. Bez sítě a bez precache vrátí prázdný – aplikace pak čte systémovým hlasem. */
export function loadManifest(): Promise<AudioManifest> {
  pending ??= fetch(mediaUrl('media-manifest.json'))
    .then((response) => (response.ok ? response.json() : null))
    .then(parseManifest)
    .catch(() => EMPTY_MANIFEST);
  return pending;
}
