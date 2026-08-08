import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { DB_PATH } from './paths';

let db: Database.Database | null = null;
export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS sprite_status (
    char TEXT NOT NULL, pose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok', error TEXT, updated_at INTEGER,
    PRIMARY KEY (char, pose)
  );`);
  return db;
}

export type SpriteStatus = { char: string; pose: string; status: string; error?: string | null; updated_at?: number | null };

export function setStatus(char: string, pose: string, status: string, error?: string | null): void {
  getDb().prepare(`INSERT INTO sprite_status (char, pose, status, error, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(char, pose) DO UPDATE SET status = excluded.status, error = excluded.error, updated_at = excluded.updated_at`)
    .run(char, pose, status, error ?? null, Date.now());
}

export function allStatuses(): SpriteStatus[] {
  return getDb().prepare('SELECT char, pose, status, error, updated_at FROM sprite_status').all() as SpriteStatus[];
}
