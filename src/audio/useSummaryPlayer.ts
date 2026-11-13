import { useCallback, useEffect, useRef, useState } from 'react';
import { loadManifest, audioUrl } from './manifest';
import { lessonSpeech } from './pronounce';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';
/** file = předem vygenerovaný zvuk, speech = systémový hlas prohlížeče. */
export type PlayerSource = 'file' | 'speech' | null;

interface Speakable { id: string; title: string; audioSummary: string }

const speechSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Přehrávač shrnutí lekce. Zkusí předem vygenerovaný soubor (ze sítě nebo ze staženého balíčku);
 * když není nebo nejde přehrát, čte text systémovým hlasem s přepisem zkratek.
 */
export function useSummaryPlayer(onEnded?: () => void) {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [source, setSource] = useState<PlayerSource>(null);
  const [rate, setRateState] = useState(1);
  const audio = useRef<HTMLAudioElement | null>(null);
  // Každé spuštění má své číslo; události z dřívějšího přehrávání se podle něj zahodí.
  const run = useRef(0);
  const rateRef = useRef(1);
  const ended = useRef(onEnded);
  useEffect(() => { ended.current = onEnded; }, [onEnded]);

  const silence = useCallback(() => {
    run.current += 1;
    if (audio.current) { audio.current.pause(); audio.current.src = ''; audio.current = null; }
    if (speechSupported()) window.speechSynthesis.cancel();
  }, []);

  const stop = useCallback(() => { silence(); setStatus('idle'); setSource(null); }, [silence]);

  const speak = useCallback((lesson: Speakable, id: number) => {
    if (!speechSupported()) { setStatus('idle'); setSource(null); return; }
    const utterance = new SpeechSynthesisUtterance(lessonSpeech(lesson));
    utterance.lang = 'cs-CZ';
    utterance.rate = rateRef.current;
    const finish = (natural: boolean) => { if (run.current !== id) return; setStatus('idle'); setSource(null); if (natural) ended.current?.(); };
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    window.speechSynthesis.speak(utterance);
    setSource('speech');
    setStatus('playing');
  }, []);

  const play = useCallback(async (lesson: Speakable) => {
    silence();
    const id = run.current;
    setStatus('loading');
    const manifest = await loadManifest();
    if (run.current !== id) return;
    const entry = manifest.files.find((file) => file.lessonId === lesson.id);
    if (!entry) { speak(lesson, id); return; }
    const element = new Audio(audioUrl(entry));
    element.playbackRate = rateRef.current;
    element.preload = 'auto';
    audio.current = element;
    const fallback = () => { if (run.current !== id) return; audio.current = null; speak(lesson, id); };
    element.onended = () => { if (run.current !== id) return; setStatus('idle'); setSource(null); ended.current?.(); };
    element.onerror = fallback;
    try {
      await element.play();
      if (run.current !== id) return;
      setSource('file');
      setStatus('playing');
    } catch {
      fallback();
    }
  }, [silence, speak]);

  const pause = useCallback(() => {
    if (audio.current) audio.current.pause();
    else if (speechSupported()) window.speechSynthesis.pause();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    if (audio.current) void audio.current.play().catch(() => undefined);
    else if (speechSupported()) window.speechSynthesis.resume();
    setStatus('playing');
  }, []);

  const setRate = useCallback((value: number) => {
    rateRef.current = value;
    setRateState(value);
    if (audio.current) audio.current.playbackRate = value;
  }, []);

  useEffect(() => silence, [silence]);

  return { status, source, rate, play, pause, resume, stop, setRate };
}
