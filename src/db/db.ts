/** Data uživatele v IndexedDB. Časy jsou epoch ms (snadný export do JSON). */
import Dexie, { type EntityTable } from 'dexie';

export const DB_SCHEMA_VERSION = 1;

export interface ProgressRow {
  lessonId: string;
  status: 'started' | 'completed';
  /** Index poslední otevřené sekce šablony. */
  section: number;
  updatedAt: number;
}
export interface AnswerRow {
  id?: number;
  questionId: string;
  at: number;
  correct: boolean;
  durationMs: number;
  /** Kde otázka padla: lekce, rychlý check, trénink, zkouška. */
  mode: 'lesson' | 'quick' | 'training' | 'exam' | 'review' | 'mental';
}
export interface CardRow {
  questionId: string;
  due: number;
  /** Stav karty FSRS (data jako ISO řetězce). */
  state: Record<string, unknown>;
}
export interface MasteryRow {
  conceptId: string;
  score: number;
  answers: number;
  updatedAt: number;
}
export interface SettingRow {
  key: string;
  value: unknown;
}
export interface ReportRow {
  id?: number;
  at: number;
  kind: 'lesson' | 'question' | 'case';
  targetId: string;
  note: string;
}
export interface ExamAttemptRow {
  id?: number;
  moduleId: string;
  at: number;
  score: number;
  passed: boolean;
  durationMs: number;
}

export class DiveDb extends Dexie {
  progress!: EntityTable<ProgressRow, 'lessonId'>;
  answers!: EntityTable<AnswerRow, 'id'>;
  cards!: EntityTable<CardRow, 'questionId'>;
  mastery!: EntityTable<MasteryRow, 'conceptId'>;
  settings!: EntityTable<SettingRow, 'key'>;
  reports!: EntityTable<ReportRow, 'id'>;
  examAttempts!: EntityTable<ExamAttemptRow, 'id'>;

  constructor(name = 'diveedu') {
    super(name);
    this.version(DB_SCHEMA_VERSION).stores({
      progress: 'lessonId, updatedAt',
      answers: '++id, questionId, at',
      cards: 'questionId, due',
      mastery: 'conceptId',
      settings: 'key',
      reports: '++id, at',
      examAttempts: '++id, moduleId, at',
    });
  }
}

export const db = new DiveDb();

export const TABLES = ['progress', 'answers', 'cards', 'mastery', 'settings', 'reports', 'examAttempts'] as const;
export type TableName = (typeof TABLES)[number];
