import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { contentKeys, mediaKeys, type ContentType } from './contentKeys.js';

const dbPath = process.env.DB_PATH || join(process.cwd(), 'data', 'leads.db');
mkdirSync(dirname(dbPath), { recursive: true });
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

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    path TEXT,
    referrer TEXT,
    language TEXT,
    user_agent TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_visits_session_id ON visits(session_id);
  CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_name TEXT,
    path TEXT,
    section TEXT,
    label TEXT,
    value TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

  CREATE TABLE IF NOT EXISTS ai_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    report_text TEXT NOT NULL,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_ai_reports_created_at ON ai_reports(created_at);

  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    section TEXT,
    label TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS media (
    key TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    section TEXT,
    label TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    chat_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

ensureColumn('site_content', 'type', "TEXT DEFAULT 'text'");
ensureColumn('site_content', 'section', 'TEXT');
ensureColumn('site_content', 'label', 'TEXT');
ensureColumn('site_content', 'updated_at', 'DATETIME');
db.prepare('UPDATE site_content SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL').run();
seedEditableKeys();

export interface LeadInput {
  name: string;
  phone: string;
  email?: string;
  service?: string;
  message?: string;
  source?: string;
}

export interface VisitInput {
  sessionId: string;
  path?: string;
  referrer?: string;
  language?: string;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
}

export interface EventInput {
  sessionId: string;
  eventType: string;
  eventName?: string;
  path?: string;
  section?: string;
  label?: string;
  value?: string;
  metadata?: Record<string, unknown>;
}

export type StatsPeriod = 'today' | 'week' | 'month';

export interface SiteContentRow {
  key: string;
  value: string;
  type: ContentType;
  section: string | null;
  label: string | null;
  updated_at: string;
}

export interface SiteContentInput {
  value: string;
  type?: ContentType;
  section?: string | null;
  label?: string | null;
}

export interface MediaRow {
  key: string;
  file_path: string;
  public_url: string;
  original_name: string | null;
  mime_type: string | null;
  section: string | null;
  label: string | null;
  updated_at: string;
}

export interface MediaInput {
  filePath: string;
  publicUrl: string;
  originalName?: string | null;
  mimeType?: string | null;
  section?: string | null;
  label?: string | null;
}

export function createLead(input: LeadInput) {
  const stmt = db.prepare(
    `INSERT INTO leads (name, phone, email, service, message, source)
     VALUES (@name, @phone, @email, @service, @message, @source)`
  );
  return stmt.run({
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    service: input.service || null,
    message: input.message || null,
    source: input.source || 'website',
  });
}

export function getLeads(limit = 100, offset = 0) {
  const stmt = db.prepare(
    `SELECT * FROM leads ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
  );
  return stmt.all({ limit, offset }) as any[];
}

export function createVisit(input: VisitInput) {
  const stmt = db.prepare(
    `INSERT INTO visits (session_id, path, referrer, language, user_agent, screen_width, screen_height)
     VALUES (@sessionId, @path, @referrer, @language, @userAgent, @screenWidth, @screenHeight)`
  );
  return stmt.run({
    sessionId: input.sessionId,
    path: input.path || null,
    referrer: input.referrer || null,
    language: input.language || null,
    userAgent: input.userAgent || null,
    screenWidth: input.screenWidth || null,
    screenHeight: input.screenHeight || null,
  });
}

export function createEvent(input: EventInput) {
  const stmt = db.prepare(
    `INSERT INTO events (session_id, event_type, event_name, path, section, label, value, metadata)
     VALUES (@sessionId, @eventType, @eventName, @path, @section, @label, @value, @metadata)`
  );
  return stmt.run({
    sessionId: input.sessionId,
    eventType: input.eventType,
    eventName: input.eventName || null,
    path: input.path || null,
    section: input.section || null,
    label: input.label || null,
    value: input.value || null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

function periodCondition(period: StatsPeriod, column = 'created_at') {
  if (period === 'month') return `${column} >= datetime('now', '-30 days')`;
  if (period === 'week') return `${column} >= datetime('now', '-7 days')`;
  return `date(${column}) = date('now')`;
}

function countWhere(table: string, condition: string) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE ${condition}`).get() as { count: number };
  return row.count;
}

export function getStats(period: StatsPeriod = 'today') {
  const condition = periodCondition(period);
  const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number };
  const periodLeads = countWhere('leads', condition);
  const visits = countWhere('visits', condition);
  const uniqueVisitors = db.prepare(
    `SELECT COUNT(DISTINCT session_id) as count FROM visits WHERE ${condition}`
  ).get() as { count: number };
  const events = countWhere('events', condition);
  const formStarts = db.prepare(
    `SELECT COUNT(DISTINCT session_id) as count FROM events WHERE ${condition} AND event_type = 'form_start'`
  ).get() as { count: number };
  const formSubmits = db.prepare(
    `SELECT COUNT(*) as count FROM events WHERE ${condition} AND event_type = 'form_submit_success'`
  ).get() as { count: number };
  const ctaClicks = db.prepare(
    `SELECT COUNT(*) as count FROM events WHERE ${condition} AND event_type IN ('cta_click', 'messenger_click', 'phone_click')`
  ).get() as { count: number };
  const maxScroll = db.prepare(
    `SELECT AVG(CAST(value AS INTEGER)) as average, MAX(CAST(value AS INTEGER)) as max
     FROM events WHERE ${condition} AND event_type = 'scroll_depth'`
  ).get() as { average: number | null; max: number | null };
  const byService = db.prepare(
    `SELECT COALESCE(service, 'Не указано') as service, COUNT(*) as count
     FROM leads WHERE ${condition} GROUP BY COALESCE(service, 'Не указано') ORDER BY count DESC LIMIT 10`
  ).all() as { service: string; count: number }[];
  const topEvents = db.prepare(
    `SELECT event_type as type, COALESCE(event_name, label, section, '') as name, COUNT(*) as count
     FROM events WHERE ${condition}
     GROUP BY event_type, COALESCE(event_name, label, section, '')
     ORDER BY count DESC LIMIT 15`
  ).all() as { type: string; name: string; count: number }[];
  const topSections = db.prepare(
    `SELECT section, COUNT(*) as count FROM events
     WHERE ${condition} AND section IS NOT NULL AND section != ''
     GROUP BY section ORDER BY count DESC LIMIT 10`
  ).all() as { section: string; count: number }[];
  const languages = db.prepare(
    `SELECT language, COUNT(*) as count FROM visits
     WHERE ${condition} AND language IS NOT NULL AND language != ''
     GROUP BY language ORDER BY count DESC LIMIT 10`
  ).all() as { language: string; count: number }[];

  return {
    period,
    leads: {
      total: totalLeads.count,
      period: periodLeads,
      byService,
    },
    traffic: {
      visits,
      uniqueVisitors: uniqueVisitors.count,
      events,
      languages,
    },
    engagement: {
      formStarts: formStarts.count,
      formSubmits: formSubmits.count,
      ctaClicks: ctaClicks.count,
      averageScrollDepth: Math.round(maxScroll.average || 0),
      maxScrollDepth: maxScroll.max || 0,
      conversionRate: visits > 0 ? Number(((periodLeads / visits) * 100).toFixed(1)) : 0,
    },
    topEvents,
    topSections,
  };
}

export function createAiReport(period: StatsPeriod, summary: unknown, reportText: string, model?: string) {
  const stmt = db.prepare(
    `INSERT INTO ai_reports (period, summary_json, report_text, model)
     VALUES (?, ?, ?, ?)`
  );
  return stmt.run(period, JSON.stringify(summary), reportText, model || null);
}

export function getAiReports(limit = 10) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  return db.prepare(
    `SELECT id, period, report_text, model, created_at FROM ai_reports ORDER BY created_at DESC LIMIT ?`
  ).all(safeLimit) as { id: number; period: string; report_text: string; model: string | null; created_at: string }[];
}

export function listContent() {
  return db.prepare(
    `SELECT key, value, COALESCE(type, 'text') as type, section, label, updated_at
     FROM site_content ORDER BY section, label, key`
  ).all() as SiteContentRow[];
}

export function getContent(key: string) {
  return db.prepare(
    `SELECT key, value, COALESCE(type, 'text') as type, section, label, updated_at
     FROM site_content WHERE key = ?`
  ).get(key) as SiteContentRow | undefined;
}

export function setContent(key: string, input: string | SiteContentInput) {
  const value = typeof input === 'string' ? input : input.value;
  const definition = contentKeys.find((item) => item.key === key);
  const type = typeof input === 'string' ? definition?.type || 'text' : input.type || definition?.type || 'text';
  const section = typeof input === 'string' ? definition?.section || null : input.section ?? definition?.section ?? null;
  const label = typeof input === 'string' ? definition?.label || null : input.label ?? definition?.label ?? null;
  const stmt = db.prepare(
    `INSERT INTO site_content (key, value, type, section, label) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value=excluded.value,
       type=excluded.type,
       section=excluded.section,
       label=excluded.label,
       updated_at=CURRENT_TIMESTAMP`
  );
  stmt.run(key, value, type, section, label);
  return getContent(key);
}

export function listMedia() {
  return db.prepare(
    `SELECT key, file_path, public_url, original_name, mime_type, section, label, updated_at
     FROM media ORDER BY section, label, key`
  ).all() as MediaRow[];
}

export function getMedia(key: string) {
  return db.prepare(
    `SELECT key, file_path, public_url, original_name, mime_type, section, label, updated_at
     FROM media WHERE key = ?`
  ).get(key) as MediaRow | undefined;
}

export function setMedia(key: string, input: MediaInput) {
  const definition = mediaKeys.find((item) => item.key === key);
  const section = input.section ?? definition?.section ?? null;
  const label = input.label ?? definition?.label ?? null;
  const stmt = db.prepare(
    `INSERT INTO media (key, file_path, public_url, original_name, mime_type, section, label)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       file_path=excluded.file_path,
       public_url=excluded.public_url,
       original_name=excluded.original_name,
       mime_type=excluded.mime_type,
       section=excluded.section,
       label=excluded.label,
       updated_at=CURRENT_TIMESTAMP`
  );
  stmt.run(key, input.filePath, input.publicUrl, input.originalName || null, input.mimeType || null, section, label);
  return getMedia(key);
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

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((item) => item.name === column)) return;

  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (err) {
    console.warn(`Could not add ${table}.${column}:`, err);
  }
}

function seedEditableKeys() {
  const contentStmt = db.prepare(
    `INSERT INTO site_content (key, value, type, section, label)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       type=COALESCE(site_content.type, excluded.type),
       section=COALESCE(site_content.section, excluded.section),
       label=COALESCE(site_content.label, excluded.label)`
  );

  const mediaStmt = db.prepare(
    `INSERT INTO media (key, file_path, public_url, original_name, mime_type, section, label)
     VALUES (?, '', '', NULL, NULL, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       section=COALESCE(media.section, excluded.section),
       label=COALESCE(media.label, excluded.label)`
  );

  const transaction = db.transaction(() => {
    for (const item of contentKeys) {
      contentStmt.run(item.key, item.defaultValue, item.type, item.section, item.label);
    }

    for (const item of mediaKeys) {
      mediaStmt.run(item.key, item.section, item.label);
    }
  });

  transaction();
}
