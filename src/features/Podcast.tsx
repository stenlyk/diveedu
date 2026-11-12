import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { nextRate, buildPlaylist, step } from '../audio/playlist';
import { useSummaryPlayer } from '../audio/useSummaryPlayer';
import { Card, PageHeader } from '../components/ui';
import { content, lessonsById } from '../content';

const STORE = 'diveedu:poslech';

function readStore(): { moduleId: string; index: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? 'null') as { moduleId?: unknown; index?: unknown } | null;
    if (raw && typeof raw.moduleId === 'string' && typeof raw.index === 'number') return { moduleId: raw.moduleId, index: raw.index };
  } catch { /* úložiště nemusí být dostupné */ }
  return { moduleId: 'all', index: 0 };
}

/**
 * Režim poslechu: shrnutí lekcí jedno po druhém, s velkým ovládáním a přepisem.
 * Určeno pro chvíle, kdy se nejde dívat na obrazovku; proto tři tlačítka a nic dalšího.
 */
export function Podcast() {
  const [moduleId, setModuleId] = useState(() => readStore().moduleId);
  const tracks = useMemo(() => buildPlaylist(content.modules, content.lessons, moduleId), [moduleId]);
  const [index, setIndex] = useState(() => { const stored = readStore(); return Math.max(0, Math.min(stored.index, buildPlaylist(content.modules, content.lessons, stored.moduleId).length - 1)); });
  const [continuous, setContinuous] = useState(false);
  const current = tracks[index];
  const lesson = current ? lessonsById.get(current.lessonId) : undefined;

  const advance = useCallback(() => {
    const next = step(index, tracks.length, 1);
    if (next === null) { setContinuous(false); return; }
    setIndex(next);
  }, [index, tracks.length]);
  const player = useSummaryPlayer(continuous ? advance : undefined);
  const { play, stop } = player;

  // Po přechodu na další skladbu v souvislém režimu se přehrávání spustí samo.
  useEffect(() => {
    if (continuous && lesson) void play(lesson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, continuous, lesson?.id]);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ moduleId, index })); } catch { /* bez úložiště si pozici nepamatujeme */ }
  }, [moduleId, index]);

  const go = (delta: 1 | -1) => {
    const next = step(index, tracks.length, delta);
    if (next === null) return;
    if (!continuous) stop();
    setIndex(next);
  };
  const toggle = () => {
    if (player.status === 'playing') { player.pause(); return; }
    if (player.status === 'paused') { player.resume(); return; }
    if (continuous && lesson) void play(lesson);
    setContinuous(true);
  };
  const halt = () => { setContinuous(false); stop(); };

  // Ovládání ze zamčené obrazovky, sluchátek a palubní desky.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.moduleTitle, album: 'DiveEdu – shrnutí lekcí' });
    const handlers: [MediaSessionAction, () => void][] = [['play', toggle], ['pause', toggle], ['nexttrack', () => go(1)], ['previoustrack', () => go(-1)], ['stop', halt]];
    for (const [action, handler] of handlers) { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* akce není podporovaná */ } }
    return () => { for (const [action] of handlers) { try { navigator.mediaSession.setActionHandler(action, null); } catch { /* totéž */ } } };
  });

  const playing = player.status === 'playing' || player.status === 'loading';
  return (
    <div className="max-w-2xl">
      <PageHeader title="Poslech" subtitle="Shrnutí lekcí jedno po druhém. Opakování, ne výuka: nové věci se uč v lekcích." />
      <label className="mb-4 block text-sm">
        <span className="text-muted">Co přehrávat</span>
        <select className="mt-1 block min-h-12 w-full rounded-xl border border-border bg-surface px-3" value={moduleId} onChange={(event) => { halt(); setModuleId(event.target.value); setIndex(0); }}>
          <option value="all">Všechny moduly</option>
          {content.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
        </select>
      </label>
      {!current || !lesson ? <p className="text-muted">V tomto výběru nejsou žádné lekce.</p> : (
        <>
          <Card>
            <div className="text-sm text-muted" data-testid="podcast-position">{index + 1} / {tracks.length} · {current.moduleTitle}</div>
            <h2 className="mt-1 text-xl font-bold" data-testid="podcast-title">{current.title}</h2>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <button type="button" aria-label="Předchozí" disabled={step(index, tracks.length, -1) === null} onClick={() => go(-1)} className="min-h-20 rounded-2xl border-2 border-border text-3xl disabled:opacity-40">⏮</button>
              <button type="button" aria-label={playing ? 'Pozastavit' : 'Přehrát'} onClick={toggle} className="min-h-20 rounded-2xl border-2 border-accent bg-accent/15 text-4xl" data-status={player.status} data-testid="podcast-toggle">{playing ? '⏸' : '▶'}</button>
              <button type="button" aria-label="Další" disabled={step(index, tracks.length, 1) === null} onClick={() => go(1)} className="min-h-20 rounded-2xl border-2 border-border text-3xl disabled:opacity-40">⏭</button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <button type="button" onClick={() => player.setRate(nextRate(player.rate))} className="min-h-11 rounded-xl border border-border px-4 font-semibold tabular-nums" aria-label={`Rychlost ${String(player.rate).replace('.', ',')}×, změnit`}>{String(player.rate).replace('.', ',')}×</button>
              <span className="text-muted" role="status" data-testid="podcast-source">
                {player.status === 'idle' ? 'Zastaveno' : player.source === 'file' ? 'Nahraný hlas' : player.source === 'speech' ? 'Systémový hlas zařízení' : 'Načítám…'}
              </span>
              <button type="button" onClick={halt} disabled={player.status === 'idle' && !continuous} className="min-h-11 rounded-xl border border-border px-4 font-semibold disabled:opacity-40">■ Stop</button>
            </div>
          </Card>
          <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Přepis</h3>
          <p className="leading-relaxed" data-testid="podcast-transcript">{lesson.audioSummary}</p>
          <p className="mt-3 text-sm"><Link to={`/uceni/${lesson.id}`} className="text-accent underline underline-offset-4">Otevřít lekci</Link></p>
        </>
      )}
    </div>
  );
}
