import { describe, expect, it } from 'vitest';
import { EMPTY_MANIFEST, formatBytes, formatDuration, packsOf, parseManifest } from './manifest';
import { buildPlaylist, nextRate, step } from './playlist';

const modules = [{ id: 'b', title: 'Druhý', order: 2 }, { id: 'a', title: 'První', order: 1 }];
const lessons = [
  { id: 'a2', moduleId: 'a', title: 'A dva', order: 2 },
  { id: 'b1', moduleId: 'b', title: 'B jedna', order: 1 },
  { id: 'a1', moduleId: 'a', title: 'A jedna', order: 1 },
];
const file = (lessonId: string, bytes: number, seconds: number) => ({ lessonId, file: `media/x/${lessonId}.m4a`, bytes, seconds, hash: 'h' });

describe('playlist', () => {
  it('řadí podle modulů a lekcí', () => {
    expect(buildPlaylist(modules, lessons, 'all').map((track) => track.lessonId)).toEqual(['a1', 'a2', 'b1']);
    expect(buildPlaylist(modules, lessons, 'b')).toEqual([{ lessonId: 'b1', moduleId: 'b', title: 'B jedna', moduleTitle: 'Druhý' }]);
    expect(buildPlaylist(modules, lessons, 'neni')).toEqual([]);
  });
  it('krokuje a na koncích vrací null', () => {
    expect(step(0, 3, 1)).toBe(1);
    expect(step(2, 3, 1)).toBeNull();
    expect(step(0, 3, -1)).toBeNull();
    expect(step(2, 3, -1)).toBe(1);
  });
  it('rychlosti se střídají dokola', () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(1.25)).toBe(1.5);
    expect(nextRate(1.5)).toBe(1);
    expect(nextRate(7)).toBe(1);
  });
});

describe('manifest', () => {
  it('skládá balíčky po modulech a sčítá velikost', () => {
    const manifest = { voice: 'v', generatedAt: 'd', files: [file('a1', 100, 10), file('b1', 300, 30), file('a2', 200, 20), file('cizi', 1, 1)], animations: [] };
    expect(packsOf(manifest, lessons, ['a', 'b', 'c'])).toEqual([
      { moduleId: 'a', files: [manifest.files[0], manifest.files[2]], bytes: 300, seconds: 30 },
      { moduleId: 'b', files: [manifest.files[1]], bytes: 300, seconds: 30 },
    ]);
    expect(packsOf(EMPTY_MANIFEST, lessons, ['a'])).toEqual([]);
    const withAnimation = { ...EMPTY_MANIFEST, animations: [{ id: 'x', moduleId: 'b', file: 'media/animace/x.mp3', bytes: 50, seconds: 5, hash: 'h', cues: [0, 2] }] };
    expect(packsOf(withAnimation, lessons, ['a', 'b'])).toEqual([{ moduleId: 'b', files: [{ lessonId: 'animace:x', file: 'media/animace/x.mp3', bytes: 50, seconds: 5, hash: 'h' }], bytes: 50, seconds: 5 }]);
  });
  it('formátuje velikost a délku', () => {
    expect(formatBytes(200)).toBe('1 kB');
    expect(formatBytes(180_000)).toBe('176 kB');
    expect(formatBytes(2_400_000)).toBe('2,3 MB');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(5)).toBe('0:05');
  });
  it('nedůvěřuje tvaru staženého manifestu', () => {
    expect(parseManifest(null)).toBe(EMPTY_MANIFEST);
    expect(parseManifest('x')).toBe(EMPTY_MANIFEST);
    expect(parseManifest({ files: 'x' })).toBe(EMPTY_MANIFEST);
    expect(parseManifest({ voice: 1, files: [file('a1', 1, 1), { lessonId: 'bez-souboru' }, null] })).toEqual({ voice: '', generatedAt: '', files: [file('a1', 1, 1)], animations: [] });
    const animation = { id: 'x', moduleId: 'm', file: 'f', bytes: 1, seconds: 1, hash: 'h', cues: [0, 0.5] };
    expect(parseManifest({ voice: 'Zuzana', generatedAt: '2026', files: [], animations: [animation, { id: 'bez-vet', moduleId: 'm', file: 'f', bytes: 1, seconds: 1 }, { ...animation, cues: ['a'] }] })).toEqual({ voice: 'Zuzana', generatedAt: '2026', files: [], animations: [animation] });
  });
});
