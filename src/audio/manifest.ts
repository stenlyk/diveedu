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

export interface AudioManifest {
  /** Hlas a nástroj, kterým zvuk vznikl. */
  voice: string;
  generatedAt: string;
  files: AudioFile[];
}

export interface AudioPack {
  moduleId: string;
  files: AudioFile[];
  bytes: number;
  seconds: number;
}

export const EMPTY_MANIFEST: AudioManifest = { voice: '', generatedAt: '', files: [] };

/** Balíčky po modulech, v pořadí modulů; moduly bez zvuku se vynechají. */
export function packsOf(manifest: AudioManifest, lessons: readonly { id: string; moduleId: string }[], moduleOrder: readonly string[]): AudioPack[] {
  const moduleOfLesson = new Map(lessons.map((lesson) => [lesson.id, lesson.moduleId]));
  const byModule = new Map<string, AudioFile[]>();
  for (const file of manifest.files) {
    const moduleId = moduleOfLesson.get(file.lessonId);
    if (!moduleId) continue;
    byModule.set(moduleId, [...(byModule.get(moduleId) ?? []), file]);
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
  return { voice: typeof raw.voice === 'string' ? raw.voice : '', generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : '', files };
}

export const mediaUrl = (file: string): string => `${import.meta.env.BASE_URL}${file}`;

let pending: Promise<AudioManifest> | null = null;

/** Manifest se načte jednou za běh aplikace. Bez sítě a bez precache vrátí prázdný – aplikace pak čte systémovým hlasem. */
export function loadManifest(): Promise<AudioManifest> {
  pending ??= fetch(mediaUrl('media-manifest.json'))
    .then((response) => (response.ok ? response.json() : null))
    .then(parseManifest)
    .catch(() => EMPTY_MANIFEST);
  return pending;
}
