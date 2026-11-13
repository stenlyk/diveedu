/** Zvukové balíčky ke stažení: soubory jednoho modulu uložené do mezipaměti, ze které je service worker podává offline. */
import { type AudioPack, audioUrl } from './manifest';

/** Název musí odpovídat runtime cache v nastavení Workboxu (vite.config.ts). */
export const MEDIA_CACHE = 'media';

export const packsSupported = (): boolean => typeof caches !== 'undefined';

/** Kolik souborů balíčku je v zařízení. */
export async function cachedCount(pack: AudioPack): Promise<number> {
  if (!packsSupported()) return 0;
  const cache = await caches.open(MEDIA_CACHE);
  const hits = await Promise.all(pack.files.map((file) => cache.match(audioUrl(file))));
  return hits.filter(Boolean).length;
}

/** Stáhne chybějící soubory balíčku. Selže-li jediný, vyhodí chybu; už stažené soubory zůstanou. */
export async function downloadPack(pack: AudioPack, onProgress: (done: number, total: number) => void): Promise<void> {
  const cache = await caches.open(MEDIA_CACHE);
  let done = 0;
  for (const file of pack.files) {
    const url = audioUrl(file);
    if (!(await cache.match(url))) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Soubor ${file.file} se nepodařilo stáhnout (${response.status}).`);
      await cache.put(url, response);
    }
    done += 1;
    onProgress(done, pack.files.length);
  }
}

export async function deletePack(pack: AudioPack): Promise<void> {
  const cache = await caches.open(MEDIA_CACHE);
  await Promise.all(pack.files.map((file) => cache.delete(audioUrl(file))));
}
