import { useEffect, useMemo, useState } from 'react';
import { type AudioManifest, type AudioPack, formatBytes, formatDuration, loadManifest, packsOf } from '../audio/manifest';
import { cachedCount, deletePack, downloadPack, packsSupported } from '../audio/packs';
import { Button, Card } from '../components/ui';
import { content, modulesById } from '../content';

type RowState = { cached: number; busy: boolean; progress?: string; error?: string };

/** Zvukové balíčky po modulech: stažení do zařízení pro poslech bez připojení a jejich smazání. */
export function AudioPacks() {
  const [manifest, setManifest] = useState<AudioManifest | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const packs = useMemo(() => (manifest ? packsOf(manifest, content.lessons, content.modules.map((module) => module.id)) : []), [manifest]);

  useEffect(() => { void loadManifest().then(setManifest); }, []);
  useEffect(() => {
    let live = true;
    void Promise.all(packs.map(async (pack) => [pack.moduleId, { cached: await cachedCount(pack), busy: false }] as const)).then((entries) => { if (live) setRows(Object.fromEntries(entries)); });
    return () => { live = false; };
  }, [packs]);

  const patch = (moduleId: string, change: Partial<RowState>) => setRows((all) => ({ ...all, [moduleId]: { cached: 0, busy: false, ...all[moduleId], ...change } }));
  const download = async (pack: AudioPack) => {
    patch(pack.moduleId, { busy: true, error: undefined, progress: `0 / ${pack.files.length}` });
    try {
      await downloadPack(pack, (done, total) => patch(pack.moduleId, { progress: `${done} / ${total}` }));
      patch(pack.moduleId, { busy: false, progress: undefined, cached: pack.files.length });
    } catch {
      patch(pack.moduleId, { busy: false, progress: undefined, cached: await cachedCount(pack), error: 'Stažení se nezdařilo. Zkontroluj připojení a zkus to znovu.' });
    }
  };
  const remove = async (pack: AudioPack) => { await deletePack(pack); patch(pack.moduleId, { cached: 0 }); };

  return (
    <Card>
      <h2 className="font-semibold">Zvukové balíčky</h2>
      <p className="mt-1 text-sm text-muted">Nahraná shrnutí lekcí a hlas k animovaným výkladům pro poslech bez připojení. Text, otázky a kalkulačky fungují offline vždy; bez balíčku čte shrnutí systémový hlas zařízení.</p>
      {manifest === null ? <p className="mt-3 text-sm text-muted">Načítám…</p>
        : !packsSupported() ? <p className="mt-3 text-sm text-muted">Tento prohlížeč neumí ukládat soubory pro použití bez připojení.</p>
        : packs.length === 0 ? <p className="mt-3 text-sm text-muted" data-testid="packs-empty">V této verzi aplikace nahraný zvuk není. Shrnutí čte systémový hlas zařízení.</p>
        : (
          <ul className="mt-3 space-y-2">
            {packs.map((pack) => {
              const row = rows[pack.moduleId] ?? { cached: 0, busy: false };
              const complete = row.cached === pack.files.length;
              return (
                <li key={pack.moduleId} className="rounded-xl border border-border p-3" data-testid={`pack-${pack.moduleId}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{modulesById.get(pack.moduleId)?.title ?? pack.moduleId}</div>
                      <div className="text-sm text-muted tabular-nums">nahrávek: {pack.files.length} · {formatDuration(pack.seconds)} · {formatBytes(pack.bytes)}{complete ? ' · v zařízení' : row.cached > 0 ? ` · staženo ${row.cached} z ${pack.files.length}` : ''}</div>
                    </div>
                    {complete
                      ? <Button variant="ghost" disabled={row.busy} onClick={() => void remove(pack)}>Smazat</Button>
                      : <Button variant="secondary" disabled={row.busy} onClick={() => void download(pack)}>{row.busy ? `Stahuji ${row.progress ?? ''}` : 'Stáhnout'}</Button>}
                  </div>
                  {row.error && <p className="mt-2 text-sm text-danger" role="status">{row.error}</p>}
                </li>
              );
            })}
          </ul>
        )}
      {manifest?.voice && <p className="mt-3 text-xs text-muted">Hlas: {manifest.voice}. Strojově čtený text; výslovnost odborných zkratek řídí slovník aplikace.</p>}
    </Card>
  );
}
