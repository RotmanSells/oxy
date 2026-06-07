import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import {
  createEvent,
  createLead,
  createVisit,
  getAiReports,
  getContent,
  getMedia,
  getLeads,
  getStats,
  listContent,
  listMedia,
  setContent,
  setMedia,
  type EventInput,
  type StatsPeriod,
} from './db.js';
import { notifyTelegram } from './bot.js';
import { generateAiReport } from './ai.js';
import { getUploadDir, maxImageBytes, saveImageUpload } from './uploads.js';
import type { ContentType } from './contentKeys.js';

dotenv.config();

const app = new Hono();
const port = Number(process.env.PORT) || 3000;
const corsOrigin = process.env.CORS_ORIGIN || '*';
const maxBodyLength = 3000;
const adminSecret = process.env.ADMIN_SECRET || '';

app.use(logger());
app.use(cors({ origin: corsOrigin, allowMethods: ['POST', 'GET', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'] }));

app.get('/', (c) => c.json({ ok: true, service: 'integra-kotova-api' }));

app.get('/uploads/*', async (c) => {
  try {
    const requestedPath = decodeURIComponent(new URL(c.req.url).pathname.replace(/^\/uploads\//, ''));
    const fileName = basename(requestedPath);

    if (!fileName || fileName !== requestedPath) {
      return c.json({ ok: false, error: 'Invalid file path' }, 400);
    }

    const filePath = join(getUploadDir(), fileName);
    const bytes = await readFile(filePath);
    return new Response(bytes, {
      headers: {
        'Content-Type': mimeTypeFromFile(fileName),
        'Cache-Control': 'public, max-age=2592000',
      },
    });
  } catch {
    return c.json({ ok: false, error: 'File not found' }, 404);
  }
});

app.post('/api/contact', async (c) => {
  try {
    const body = await c.req.json();
    const lead = sanitizeLead(body);
    const validationError = validateLead(lead, JSON.stringify(body).length);

    if (validationError) {
      await saveOptionalEvent(body, 'form_submit_error', validationError);
      return c.json({ ok: false, error: validationError }, 400);
    }

    const result = createLead({ ...lead, source: 'website' });
    await saveOptionalEvent(body, 'form_submit_success', lead.service || 'contact');
    await notifyTelegram({ id: Number(result.lastInsertRowid), ...lead });

    return c.json({ ok: true, message: 'Lead received', id: Number(result.lastInsertRowid) });
  } catch (err) {
    console.error('Contact error:', err);
    return c.json({ ok: false, error: 'Server error' }, 500);
  }
});

app.post('/api/visit', async (c) => {
  try {
    const body = await c.req.json();
    const sessionId = normalizeString(body.sessionId, 120);

    if (!sessionId) {
      return c.json({ ok: false, error: 'sessionId is required' }, 400);
    }

    createVisit({
      sessionId,
      path: normalizeString(body.path, 500),
      referrer: normalizeString(body.referrer, 500),
      language: normalizeString(body.language, 20),
      userAgent: normalizeString(c.req.header('user-agent') || body.userAgent, 500),
      screenWidth: normalizeNumber(body.screenWidth),
      screenHeight: normalizeNumber(body.screenHeight),
    });

    return c.json({ ok: true });
  } catch (err) {
    console.error('Visit error:', err);
    return c.json({ ok: false, error: 'Visit error' }, 500);
  }
});

app.post('/api/events', async (c) => {
  try {
    const body = await c.req.json();
    const events = Array.isArray(body.events) ? body.events : [body];
    let saved = 0;

    for (const item of events.slice(0, 20)) {
      const event = sanitizeEvent(item);
      if (!event.sessionId || !event.eventType) continue;
      createEvent(event);
      saved += 1;
    }

    return c.json({ ok: true, saved });
  } catch (err) {
    console.error('Events error:', err);
    return c.json({ ok: false, error: 'Events error' }, 500);
  }
});

app.get('/api/stats', (c) => {
  try {
    const period = parsePeriod(c.req.query('period'), 'today');
    const stats = getStats(period);
    return c.json({ ok: true, stats });
  } catch (err) {
    console.error('Stats error:', err);
    return c.json({ ok: false, error: 'Stats error' }, 500);
  }
});

app.get('/api/leads', (c) => {
  try {
    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
    const offset = Number(c.req.query('offset')) || 0;
    const leads = getLeads(limit, offset);
    return c.json({ ok: true, leads });
  } catch (err) {
    console.error('Leads error:', err);
    return c.json({ ok: false, error: 'Leads error' }, 500);
  }
});

app.post('/api/ai/report', async (c) => {
  try {
    const body = await readOptionalJson(c.req.raw);
    const period = parsePeriod(body?.period, 'week');
    const report = await generateAiReport(period);
    return c.json({ ok: true, report });
  } catch (err) {
    console.error('AI report error:', err);
    return c.json({ ok: false, error: 'AI report error' }, 500);
  }
});

app.get('/api/ai/reports', (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 10;
    return c.json({ ok: true, reports: getAiReports(limit) });
  } catch (err) {
    console.error('AI reports error:', err);
    return c.json({ ok: false, error: 'AI reports error' }, 500);
  }
});

app.get('/api/content', (c) => {
  try {
    return c.json({
      ok: true,
      content: formatContentMap(listContent()),
      media: formatMediaMap(listMedia()),
    });
  } catch (err) {
    console.error('Content list error:', err);
    return c.json({ ok: false, error: 'Content error' }, 500);
  }
});

app.get('/api/content/:key', (c) => {
  const key = c.req.param('key');
  const content = getContent(key);

  if (!content) {
    return c.json({ ok: false, error: 'Content key not found' }, 404);
  }

  return c.json({ ok: true, key, content: formatContentItem(content) });
});

app.post('/api/content/:key', async (c) => {
  try {
    if (!hasAdminSecret(c.req.header('X-Admin-Secret'))) {
      return c.json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const key = normalizeKey(c.req.param('key'));
    if (!key) return c.json({ ok: false, error: 'Invalid content key' }, 400);

    const body = await c.req.json();
    const value = typeof body.value === 'string' ? body.value.slice(0, 12000) : '';
    const type = normalizeContentType(body.type);
    const section = normalizeString(body.section, 120) || undefined;
    const label = normalizeString(body.label, 160) || undefined;
    const content = setContent(key, { value, type, section, label });

    return c.json({ ok: true, key, content: content ? formatContentItem(content) : null });
  } catch (err) {
    console.error('Content update error:', err);
    return c.json({ ok: false, error: 'Content update error' }, 500);
  }
});

app.post('/api/media/:key', async (c) => {
  try {
    if (!hasAdminSecret(c.req.header('X-Admin-Secret'))) {
      return c.json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const key = normalizeKey(c.req.param('key'));
    if (!key) return c.json({ ok: false, error: 'Invalid media key' }, 400);

    const form = await c.req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return c.json({ ok: false, error: 'Image file is required' }, 400);
    }

    if (file.size > maxImageBytes) {
      return c.json({ ok: false, error: 'Image is too large' }, 400);
    }

    const saved = await saveImageUpload({
      key,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
      originalName: file.name,
    });
    const media = setMedia(key, {
      filePath: saved.filePath,
      publicUrl: saved.publicUrl,
      originalName: saved.originalName,
      mimeType: saved.mimeType,
      section: normalizeString(form.get('section'), 120) || undefined,
      label: normalizeString(form.get('label'), 160) || undefined,
    });

    return c.json({ ok: true, key, publicUrl: saved.publicUrl, media: media ? formatMediaItem(media) : null });
  } catch (err) {
    console.error('Media upload error:', err);
    const message = err instanceof Error ? err.message : 'Media upload error';
    const status = /Unsupported|large/i.test(message) ? 400 : 500;
    return c.json({ ok: false, error: message }, status);
  }
});

serve({ fetch: app.fetch, port });
console.log(`🚀 API running on http://localhost:${port}`);

function sanitizeLead(body: Record<string, unknown>) {
  return {
    name: normalizeString(body.name, 80),
    phone: normalizeString(body.phone, 40),
    email: normalizeString(body.email, 120),
    service: normalizeString(body.service, 120),
    message: normalizeString(body.message, 1000),
  };
}

function validateLead(lead: ReturnType<typeof sanitizeLead>, bodyLength: number) {
  if (bodyLength > maxBodyLength) return 'Request is too large';
  if (!lead.name || !lead.phone || !lead.service || !lead.message) return 'Name, phone, service and message are required';
  if (lead.name.length < 2) return 'Name is too short';
  if (lead.phone.replace(/\D/g, '').length < 7) return 'Phone is invalid';
  if (isSpamText(`${lead.name} ${lead.phone} ${lead.email} ${lead.message}`)) return 'Spam detected';
  return '';
}

function sanitizeEvent(body: Record<string, unknown>): EventInput {
  return {
    sessionId: normalizeString(body.sessionId, 120),
    eventType: normalizeString(body.eventType || body.type, 80),
    eventName: normalizeString(body.eventName || body.name, 120),
    path: normalizeString(body.path, 500),
    section: normalizeString(body.section, 120),
    label: normalizeString(body.label, 160),
    value: normalizeString(body.value, 120),
    metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  };
}

async function saveOptionalEvent(body: Record<string, unknown>, eventType: string, label: string) {
  const sessionId = normalizeString(body.sessionId, 120);
  if (!sessionId) return;

  createEvent({
    sessionId,
    eventType,
    eventName: 'contact_form',
    path: normalizeString(body.path, 500),
    section: 'contact',
    label,
  });
}

function normalizeString(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeKey(value: unknown) {
  return normalizeString(value, 80).replace(/[^a-zA-Z0-9_-]/g, '');
}

function normalizeContentType(value: unknown): ContentType | undefined {
  return value === 'text' || value === 'html' || value === 'url' ? value : undefined;
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function isSpamText(text: string) {
  const normalized = text.toLowerCase();
  const links = normalized.match(/https?:\/\/|www\./g)?.length || 0;
  return links > 2 || /\[url=|casino|viagra|crypto investment|seo backlinks/i.test(normalized);
}

function parsePeriod(value: unknown, fallback: StatsPeriod): StatsPeriod {
  return value === 'today' || value === 'week' || value === 'month' ? value : fallback;
}

async function readOptionalJson(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasAdminSecret(value: string | undefined) {
  return Boolean(adminSecret && value && value === adminSecret);
}

function formatContentMap(rows: ReturnType<typeof listContent>) {
  return Object.fromEntries(rows.map((row) => [row.key, formatContentItem(row)]));
}

function formatContentItem(row: NonNullable<ReturnType<typeof getContent>>) {
  return {
    value: row.value,
    type: row.type,
    section: row.section,
    label: row.label,
    updatedAt: row.updated_at,
  };
}

function formatMediaMap(rows: ReturnType<typeof listMedia>) {
  return Object.fromEntries(rows.map((row) => [row.key, formatMediaItem(row)]));
}

function formatMediaItem(row: NonNullable<ReturnType<typeof getMedia>>) {
  return {
    publicUrl: row.public_url || null,
    section: row.section,
    label: row.label,
    originalName: row.original_name,
    mimeType: row.mime_type,
    updatedAt: row.updated_at,
  };
}

function mimeTypeFromFile(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'application/octet-stream';
}
