/** Export a import pokroku do jednoho JSON souboru. */
import { z } from 'zod';
import { DB_SCHEMA_VERSION, type DiveDb, TABLES } from './db';

const row = z.record(z.string(), z.unknown());

export const BackupSchema = z.object({
  app: z.literal('diveedu'),
  schemaVersion: z.number().int().min(1).max(DB_SCHEMA_VERSION),
  exportedAt: z.string(),
  data: z.object({
    progress: z.array(row.and(z.object({ lessonId: z.string() }))),
    answers: z.array(row.and(z.object({ questionId: z.string(), at: z.number() }))),
    cards: z.array(row.and(z.object({ questionId: z.string() }))),
    mastery: z.array(row.and(z.object({ conceptId: z.string() }))),
    settings: z.array(row.and(z.object({ key: z.string() }))),
    reports: z.array(row),
    examAttempts: z.array(row),
  }),
});
export type Backup = z.infer<typeof BackupSchema>;

export class BackupError extends Error {}

export async function exportBackup(database: DiveDb, now = new Date()): Promise<Backup> {
  const data = Object.fromEntries(
    await Promise.all(TABLES.map(async (table) => [table, await database.table(table).toArray()] as const)),
  ) as Backup['data'];
  return { app: 'diveedu', schemaVersion: DB_SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export function parseBackup(json: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupError('Soubor není platný JSON.');
  }
  const result = BackupSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new BackupError(`Soubor není záloha DiveEdu (${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'neznámá chyba'}).`);
  }
  return result.data;
}

/** Tabulky s automatickým klíčem: při slučování se id zahazuje, aby se záznamy nepřepsaly. */
const AUTO_KEY_TABLES = new Set(['answers', 'reports', 'examAttempts']);

/**
 * replace: smaže stávající data a nahraje zálohu.
 * merge: záznamy ze zálohy se přidají; u shodného klíče vyhrává záloha.
 */
export async function importBackup(database: DiveDb, backup: Backup, mode: 'replace' | 'merge'): Promise<number> {
  let count = 0;
  await database.transaction('rw', TABLES.map((table) => database.table(table)), async () => {
    for (const table of TABLES) {
      const target = database.table(table);
      let rows: Record<string, unknown>[] = backup.data[table];
      if (mode === 'replace') await target.clear();
      else if (AUTO_KEY_TABLES.has(table)) rows = rows.map(({ id: _id, ...rest }) => rest);
      await target.bulkPut(rows);
      count += rows.length;
    }
  });
  return count;
}

export function backupFileName(now = new Date()): string {
  return `diveedu-pokrok-${now.toISOString().slice(0, 10)}.json`;
}
