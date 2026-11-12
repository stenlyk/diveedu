import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BackupError, backupFileName, exportBackup, importBackup, parseBackup } from './backup';
import { DiveDb } from './db';

let counter = 0;
let database: DiveDb;

async function seed(target: DiveDb) {
  await target.progress.put({ lessonId: 'tlak-a-hloubka', status: 'completed', section: 8, updatedAt: 1 });
  await target.answers.bulkAdd([
    { questionId: 'tlak-30m', at: 10, correct: true, durationMs: 4000, mode: 'lesson' },
    { questionId: 'tlak-30m', at: 20, correct: false, durationMs: 9000, mode: 'quick' },
  ]);
  await target.settings.put({ key: 'theme', value: 'light' });
  await target.mastery.put({ conceptId: 'hloubka', score: 0.5, answers: 2, updatedAt: 20 });
}

beforeEach(() => {
  database = new DiveDb(`test-${counter++}`);
});

describe('záloha pokroku', () => {
  it('export → JSON → import do prázdné databáze vrátí stejná data', async () => {
    await seed(database);
    const json = JSON.stringify(await exportBackup(database, new Date('2026-11-12T10:00:00Z')));
    const target = new DiveDb(`test-${counter++}`);
    const count = await importBackup(target, parseBackup(json), 'replace');
    expect(count).toBe(5);
    expect(await target.progress.toArray()).toEqual(await database.progress.toArray());
    expect(await target.answers.toArray()).toEqual(await database.answers.toArray());
    expect(await target.settings.get('theme')).toEqual({ key: 'theme', value: 'light' });
  });
  it('replace smaže předchozí data', async () => {
    await seed(database);
    const backup = await exportBackup(database);
    await database.progress.put({ lessonId: 'jina-lekce', status: 'started', section: 0, updatedAt: 5 });
    await importBackup(database, backup, 'replace');
    expect(await database.progress.count()).toBe(1);
    expect(await database.answers.count()).toBe(2);
  });
  it('merge odpovědi přidá a u shodného klíče vyhrává záloha', async () => {
    await seed(database);
    const backup = await exportBackup(database);
    await database.settings.put({ key: 'theme', value: 'dark' });
    await importBackup(database, backup, 'merge');
    expect(await database.answers.count()).toBe(4);
    expect((await database.settings.get('theme'))?.value).toBe('light');
    expect(await database.progress.count()).toBe(1);
  });
  it('odmítne poškozený soubor a cizí JSON', () => {
    expect(() => parseBackup('{nejson')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"jina"}')).toThrow(/není záloha DiveEdu/);
    expect(() => parseBackup(JSON.stringify({ app: 'diveedu', schemaVersion: 99, exportedAt: 'x', data: {} }))).toThrow(BackupError);
  });
  it('název souboru obsahuje datum', () => {
    expect(backupFileName(new Date('2026-11-12T10:00:00Z'))).toBe('diveedu-pokrok-2026-11-12.json');
  });
});
