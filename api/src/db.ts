import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = process.env.DB_PATH || join(process.cwd(), 'data', 'leads.db');
const db = new Database(dbPath);

// Миграции
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    service TEXT,
    message TEXT,
    source TEXT DEFAULT 'website',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    chat_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export interface LeadInput {
  name: string;
  phone: string;
  email?: string;
  service?: string;
  message?: string;
  source?: string;
}

export function createLead(input: LeadInput) {
  const stmt = db.prepare(
    `INSERT INTO leads (name, phone, email, service, message, source)
     VALUES (@name, @phone, @email, @service, @message, @source)`
  );
  return stmt.run(input);
}

export function getLeads(limit = 100, offset = 0) {
  const stmt = db.prepare(
    `SELECT * FROM leads ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
  );
  return stmt.all({ limit, offset }) as any[];
}

export function getStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number };
  const today = db.prepare(
    `SELECT COUNT(*) as count FROM leads WHERE date(created_at) = date('now')`
  ).get() as { count: number };
  const week = db.prepare(
    `SELECT COUNT(*) as count FROM leads WHERE created_at >= date('now', '-7 days')`
  ).get() as { count: number };
  const byService = db.prepare(
    `SELECT service, COUNT(*) as count FROM leads GROUP BY service ORDER BY count DESC`
  ).all() as { service: string; count: number }[];

  return { total: total.count, today: today.count, week: week.count, byService };
}

export function getContent(key: string) {
  const stmt = db.prepare('SELECT value FROM site_content WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setContent(key: string, value: string) {
  const stmt = db.prepare(
    `INSERT INTO site_content (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  );
  stmt.run(key, value);
}

export function addAdmin(chatId: number, username?: string, firstName?: string) {
  const stmt = db.prepare(
    `INSERT INTO admins (chat_id, username, first_name) VALUES (?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name`
  );
  stmt.run(chatId, username || null, firstName || null);
}

export function getAdmins() {
  return db.prepare('SELECT chat_id FROM admins').all() as { chat_id: number }[];
}

export function removeAdmin(chatId: number) {
  db.prepare('DELETE FROM admins WHERE chat_id = ?').run(chatId);
}

export { db };