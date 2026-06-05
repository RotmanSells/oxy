import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import dotenv from 'dotenv';
import { createLead, getLeads, getStats, getContent, setContent } from './db.js';
import { notifyTelegram } from './bot.js';

dotenv.config();

const app = new Hono();
const port = Number(process.env.PORT) || 3000;
const corsOrigin = process.env.CORS_ORIGIN || '*';

app.use(logger());
app.use(cors({ origin: corsOrigin, allowMethods: ['POST', 'GET', 'OPTIONS'] }));

// Health check
app.get('/', (c) => c.json({ ok: true, service: 'integra-kotova-api' }));

// Приём заявки с сайта
app.post('/api/contact', async (c) => {
  try {
    const body = await c.req.json();
    const { name, phone, email, service, message } = body;

    if (!name || !phone) {
      return c.json({ ok: false, error: 'Name and phone are required' }, 400);
    }

    // Сохраняем в SQLite
    createLead({ name, phone, email, service, message });

    // Отправляем в Telegram
    await notifyTelegram({ name, phone, email, service, message });

    return c.json({ ok: true, message: 'Lead received' });
  } catch (err) {
    console.error('Contact error:', err);
    return c.json({ ok: false, error: 'Server error' }, 500);
  }
});

// Статистика заявок (для будущей админки)
app.get('/api/stats', (c) => {
  try {
    const stats = getStats();
    return c.json({ ok: true, stats });
  } catch (err) {
    return c.json({ ok: false, error: 'Stats error' }, 500);
  }
});

// Список заявок (для будущей админки)
app.get('/api/leads', (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;
    const leads = getLeads(limit, offset);
    return c.json({ ok: true, leads });
  } catch (err) {
    return c.json({ ok: false, error: 'Leads error' }, 500);
  }
});

// Управление контентом сайта через бота (для будущей админки)
app.get('/api/content/:key', (c) => {
  const key = c.req.param('key');
  const value = getContent(key);
  return c.json({ ok: true, key, value });
});

app.post('/api/content/:key', async (c) => {
  const key = c.req.param('key');
  const { value } = await c.req.json();
  setContent(key, value);
  return c.json({ ok: true, key, value });
});

serve({ fetch: app.fetch, port });
console.log(`🚀 API running on http://localhost:${port}`);
