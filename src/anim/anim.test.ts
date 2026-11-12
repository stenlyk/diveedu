import { absPressure, boyleVolume, mod, ppO2, thirdsTurnBar } from '@diveedu/calc';
import { describe, expect, it } from 'vitest';
import content from '../content/generated/content.json';
import { unknownAbbreviations } from '../audio/pronounce';
import { ANIMATIONS, animationsById } from './defs';
import { clamp01, ease, estimatedTimeline, lerp, positionAt, proportionalStarts, recordedTimeline, span, startsFromCharacters } from './timing';

describe('definice výkladů', () => {
  it('každý výklad patří k existující lekci svého modulu a má jedinečné id', () => {
    expect(new Set(ANIMATIONS.map((a) => a.id)).size).toBe(ANIMATIONS.length);
    for (const animation of ANIMATIONS) {
      const lesson = content.lessons.find((l) => l.id === animation.lessonId);
      expect(lesson?.moduleId, animation.id).toBe(animation.moduleId);
      expect(animation.cues.length, animation.id).toBeGreaterThanOrEqual(4);
      expect(animationsById.get(animation.id)).toBe(animation);
    }
  });
  it('výklad jde přečíst bez neznámých zkratek', () => {
    expect(ANIMATIONS.flatMap((a) => unknownAbbreviations(a.cues.join(' ')))).toEqual([]);
  });
  it('čísla ve výkladu odpovídají výpočtům', () => {
    // Tlak a objem: 10 l z hladiny.
    expect(boyleVolume(10, 0, 10)).toBeCloseTo(5, 6);
    expect(absPressure(30)).toBeCloseTo(4, 6);
    expect(boyleVolume(10, 0, 30)).toBeCloseTo(2.5, 6);
    expect(boyleVolume(10, 10, 0)).toBeCloseTo(20, 6);
    // ppO2 a MOD.
    expect(ppO2(0.21, 0)).toBeCloseTo(0.21, 6);
    expect(absPressure(40)).toBeCloseTo(5, 6);
    expect(ppO2(0.21, 40)).toBeCloseTo(1.05, 6);
    expect(ppO2(0.32, 40)).toBeCloseTo(1.6, 6);
    expect(Math.floor(mod(0.32, 1.4))).toBe(33);
    expect(mod(0.5, 1.6)).toBeCloseTo(22, 6);
    expect(mod(1, 1.6)).toBeCloseTo(6, 6);
    // Třetiny: 210 bar, otočka na 140, zbylé dvě třetiny = cesta ven pro dva.
    expect(thirdsTurnBar(210)).toBe(140);
    expect(2 * (210 - thirdsTurnBar(210))).toBe(140);
  });
});

describe('časování', () => {
  const cues = ['aaaa', 'bbbbbbbb', 'cc'];
  it('odhad dává každé větě čas podle délky, nejméně minimum', () => {
    const timeline = estimatedTimeline(['x'.repeat(70), 'krátká']);
    expect(timeline.starts).toEqual([0, 5.6]);
    expect(timeline.duration).toBeCloseTo(5.6 + 2.5 + 0.6, 6);
    expect(estimatedTimeline([])).toEqual({ starts: [], duration: 0 });
  });
  it('nahrané časování se použije jen tehdy, když sedí', () => {
    expect(recordedTimeline(cues, [0, 2, 5], 8)).toEqual({ starts: [0, 2, 5], duration: 8 });
    const fallback = estimatedTimeline(cues);
    expect(recordedTimeline(cues, [0, 2], 8)).toEqual(fallback);
    expect(recordedTimeline(cues, [0, 5, 2], 8)).toEqual(fallback);
    expect(recordedTimeline(cues, [0, 2, 9], 8)).toEqual(fallback);
    expect(recordedTimeline(cues, [-1, 2, 5], 8)).toEqual(fallback);
    expect(recordedTimeline(cues, undefined, 8)).toEqual(fallback);
    expect(recordedTimeline(cues, [0, 2, 5], undefined)).toEqual(fallback);
  });
  it('najde větu a postup v ní', () => {
    const timeline = { starts: [0, 2, 5], duration: 8 };
    expect(positionAt(timeline, 0)).toEqual({ cue: 0, p: 0 });
    expect(positionAt(timeline, 1)).toEqual({ cue: 0, p: 0.5 });
    expect(positionAt(timeline, 2)).toEqual({ cue: 1, p: 0 });
    expect(positionAt(timeline, 6.5)).toEqual({ cue: 2, p: 0.5 });
    expect(positionAt(timeline, 99)).toEqual({ cue: 2, p: 1 });
    expect(positionAt(timeline, -5)).toEqual({ cue: 0, p: 0 });
    expect(positionAt({ starts: [], duration: 0 }, 1)).toEqual({ cue: 0, p: 1 });
  });
  it('rozdělí délku podle znaků a čte začátky ze značek', () => {
    expect(proportionalStarts(cues, 14)).toEqual([0, 4, 12]);
    expect(proportionalStarts([], 5)).toEqual([]);
    // „aaaa bbbbbbbb cc“: věty začínají na znacích 0, 5 a 14.
    const characterStarts = Array.from({ length: 16 }, (_, i) => i / 10);
    expect(startsFromCharacters(cues, characterStarts)).toEqual([0, 0.5, 1.4]);
    expect(startsFromCharacters(cues, characterStarts.slice(0, 10))).toBeNull();
  });
  it('pomocné funkce pohybu', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(10, 20, 7)).toBe(20);
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
    expect(span(0.5, 0.25, 0.75)).toBe(0.5);
    expect(span(0.1, 0.25, 0.75)).toBe(0);
    expect(span(0.9, 0.25, 0.75)).toBe(1);
  });
});
