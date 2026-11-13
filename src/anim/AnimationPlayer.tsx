import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type AnimationAudio, loadManifest, audioUrl } from '../audio/manifest';
import type { AnimationDef } from './defs';
import { SCENES } from './scenes';
import { positionAt, recordedTimeline } from './timing';

/**
 * Přehrávač animovaného výkladu. Čas určuje nahraný hlas, je-li k dispozici; jinak běží podle odhadu tempa čtení
 * a výklad se čte jen z titulků. Scéna je čistá funkce času, takže jde krokovat po větách i vracet.
 */
export function AnimationPlayer({ animation }: { animation: AnimationDef }) {
  const [recording, setRecording] = useState<AnimationAudio | null | undefined>(undefined);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const clock = useRef({ started: 0, offset: 0 });
  const timeline = useMemo(() => recordedTimeline(animation.cues, recording?.cues, recording?.seconds), [animation.cues, recording]);
  const position = positionAt(timeline, time);
  const Scene = SCENES[animation.id];

  useEffect(() => {
    let live = true;
    void loadManifest().then((manifest) => { if (live) setRecording(manifest.animations.find((item) => item.id === animation.id) ?? null); });
    return () => { live = false; };
  }, [animation.id]);

  const silence = useCallback(() => { if (audio.current) { audio.current.pause(); audio.current.src = ''; audio.current = null; } }, []);
  useEffect(() => silence, [silence]);

  // Hodiny: zvuk, pokud hraje; jinak čas od spuštění.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const now = audio.current ? audio.current.currentTime : clock.current.offset + (performance.now() - clock.current.started) / 1000;
      if (now >= timeline.duration || audio.current?.ended) {
        setTime(timeline.duration);
        setPlaying(false);
        silence();
        return;
      }
      setTime(now);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, timeline.duration, silence]);

  const start = async (from: number) => {
    silence();
    clock.current = { started: performance.now(), offset: from };
    setTime(from);
    if (recording) {
      const element = new Audio(audioUrl(recording));
      element.currentTime = from;
      try {
        await element.play();
        audio.current = element;
        setVoice(true);
      } catch {
        // Soubor není dostupný (offline bez balíčku): výklad poběží potichu s titulky.
        setVoice(false);
        clock.current = { started: performance.now(), offset: from };
      }
    } else {
      setVoice(false);
    }
    setPlaying(true);
  };
  const pause = () => { audio.current?.pause(); setPlaying(false); silence(); };
  const toggle = () => { if (playing) pause(); else void start(time >= timeline.duration ? 0 : time); };
  const jump = (cue: number) => {
    const target = timeline.starts[Math.max(0, Math.min(cue, animation.cues.length - 1))] ?? 0;
    if (playing) void start(target);
    else setTime(target);
  };

  if (!Scene) return null;
  return (
    <figure className="not-prose my-4 max-w-none" data-testid="animation" data-cue={position.cue}>
      <Scene cue={position.cue} p={position.p} />
      <div className="mt-2 h-1.5 overflow-hidden rounded-[2px] bg-border" aria-hidden="true"><div className="h-1.5 bg-accent" style={{ width: `${(time / timeline.duration) * 100}%` }} /></div>
      <figcaption className="mt-3 min-h-[4.5rem] text-base leading-relaxed" data-testid="animation-caption">{animation.cues[position.cue]}</figcaption>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" aria-label="Předchozí věta" disabled={position.cue === 0 && time === 0} onClick={() => jump(position.p > 0.15 || position.cue === 0 ? position.cue : position.cue - 1)} className="min-h-14 rounded-xl border-2 border-border text-2xl disabled:opacity-40">⏮</button>
        <button type="button" aria-label={playing ? 'Pozastavit výklad' : 'Přehrát výklad'} onClick={toggle} className="min-h-14 rounded-xl border-2 border-accent bg-accent/15 text-2xl" data-testid="animation-toggle">{playing ? '⏸' : '▶'}</button>
        <button type="button" aria-label="Další věta" disabled={position.cue >= animation.cues.length - 1} onClick={() => jump(position.cue + 1)} className="min-h-14 rounded-xl border-2 border-border text-2xl disabled:opacity-40">⏭</button>
      </div>
      <p className="mt-2 text-xs text-muted" role="status">
        {animation.title} · věta {position.cue + 1} z {animation.cues.length}
        {playing ? (voice ? ' · namluveno' : ' · bez hlasu, čti titulky') : recording === null ? ' · hlas není k dispozici, výklad poběží s titulky' : ''}
      </p>
    </figure>
  );
}
