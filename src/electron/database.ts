import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

const ENTITY_TABLES = [
  'products',
  'transactions',
  'customers',
  'users',
  'suppliers',
  'purchase_orders',
  'expenses',
  'audit_logs',
];

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'bookshop.db');
  console.log('[database] Opening SQLite DB at:', dbPath);
  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create entity tables (each row stores a JSON object with an extracted id)
  for (const table of ENTITY_TABLES) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id   TEXT PRIMARY KEY,
        json TEXT NOT NULL
      )
    `);
  }

  // Key-value table for app settings and metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  console.log('[database] Initialised successfully');
}

// ── Read helpers ────────────────────────────────────────────────

export function dbGetAll(table: string): unknown[] {
  if (!ENTITY_TABLES.includes(table)) return [];
  const rows = db.prepare(`SELECT json FROM ${table}`).all() as { json: string }[];
  return rows.map(r => JSON.parse(r.json));
}

// ── Write helpers ───────────────────────────────────────────────

export function dbUpsert(table: string, id: string, data: unknown): void {
  if (!ENTITY_TABLES.includes(table)) return;
  db.prepare(`INSERT OR REPLACE INTO ${table} (id, json) VALUES (?, ?)`)
    .run(id, JSON.stringify(data));
}

export function dbDelete(table: string, id: string): void {
  if (!ENTITY_TABLES.includes(table)) return;
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

export function dbSaveAll(table: string, items: { id: string }[]): void {
  if (!ENTITY_TABLES.includes(table)) return;
  const del = db.prepare(`DELETE FROM ${table}`);
  const ins = db.prepare(`INSERT INTO ${table} (id, json) VALUES (?, ?)`);

  db.transaction(() => {
    del.run();
    for (const item of items) {
      ins.run(item.id, JSON.stringify(item));
    }
  })();
}

// ── Settings ────────────────────────────────────────────────────

export function dbGetSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function dbSaveSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// ── Bulk load (sent to renderer on startup) ─────────────────────

export function dbLoadAll(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const table of ENTITY_TABLES) {
    result[table] = dbGetAll(table);
  }
  // Also include app settings
  const settingsRaw = dbGetSetting('app_settings');
  result.settings = settingsRaw ? JSON.parse(settingsRaw) : null;
  return result;
}

// ── Bulk import (for restore / migration) ───────────────────────

export function dbImportAll(data: Record<string, { id: string }[]>): void {
  db.transaction(() => {
    for (const [table, items] of Object.entries(data)) {
      if (ENTITY_TABLES.includes(table) && Array.isArray(items)) {
        dbSaveAll(table, items);
      }
    }
  })();
}

// ── Cleanup ─────────────────────────────────────────────────────

export function closeDatabase(): void {
  if (db) {
    console.log('[database] Closing');
    db.close();
  }
}
