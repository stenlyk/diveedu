import { useEffect, useRef } from 'react';

/**
 * Zvuk dechu generovaný v prohlížeči (šum s obálkou), bez zvukových souborů – funguje i offline.
 * rate = dechů za minutu; při stresu rychlejší.
 */
export function useBreathing(enabled: boolean, rate: number): void {
  const context = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const audio = context.current ?? new AudioCtor();
    context.current = audio;
    void audio.resume().catch(() => undefined);

    const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const breath = () => {
      const source = audio.createBufferSource();
      source.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 500;
      const gain = audio.createGain();
      const now = audio.currentTime;
      // Nádech (syčení automatiky), krátká pauza, výdech (bubliny – hlubší tón).
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.25);
      gain.gain.linearRampToValueAtTime(0, now + 1.1);
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.setValueAtTime(250, now + 1.3);
      gain.gain.setValueAtTime(0, now + 1.3);
      gain.gain.linearRampToValueAtTime(0.09, now + 1.5);
      gain.gain.linearRampToValueAtTime(0, now + 2);
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start(now);
      source.stop(now + 2);
    };
    breath();
    const timer = setInterval(breath, Math.max(2200, 60_000 / rate));
    return () => clearInterval(timer);
  }, [enabled, rate]);
  useEffect(() => () => { void context.current?.close().catch(() => undefined); }, []);
}
