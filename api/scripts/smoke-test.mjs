import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const port = 3199;
const tempDir = await mkdtemp(join(tmpdir(), 'integra-api-smoke-'));
const env = {
  ...process.env,
  PORT: String(port),
  BOT_TOKEN: '',
  CHAT_ID: '',
  OPENAI_API_KEY: '',
  CORS_ORIGIN: '*',
  DB_PATH: join(tempDir, 'smoke.db'),
};

const server = spawn(process.execPath, ['dist/index.js'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', chunk => {
  output += chunk.toString();
});
server.stderr.on('data', chunk => {
  output += chunk.toString();
});

try {
  await waitForServer(outputRef, 6000);

  const health = await request('/');
  assert.equal(health.ok, true);

  const visit = await request('/api/visit', {
    method: 'POST',
    body: {
      sessionId: 'smoke-session',
      path: '/',
      language: 'ru',
      screenWidth: 1440,
      screenHeight: 900,
    },
  });
  assert.equal(visit.ok, true);

  const events = await request('/api/events', {
    method: 'POST',
    body: {
      events: [
        { sessionId: 'smoke-session', eventType: 'cta_click', eventName: 'cta', section: 'hero', label: 'Оставить заявку' },
        { sessionId: 'smoke-session', eventType: 'scroll_depth', eventName: 'scroll', value: '75' },
      ],
    },
  });
  assert.equal(events.ok, true);
  assert.equal(events.saved, 2);

  const invalidLeadResponse = await fetch(`http://localhost:${port}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'A', phone: '1' }),
  });
  assert.equal(invalidLeadResponse.status, 400);

  const lead = await request('/api/contact', {
    method: 'POST',
    body: {
      name: 'Тестовый клиент',
      phone: '+79991234567',
      service: 'Строительство',
      message: 'Хочу консультацию',
      sessionId: 'smoke-session',
      path: '/',
    },
  });
  assert.equal(lead.ok, true);
  assert.equal(lead.id, 1);

  const stats = await request('/api/stats?period=today');
  assert.equal(stats.ok, true);
  assert.equal(stats.stats.leads.period, 1);
  assert.equal(stats.stats.traffic.visits, 1);
  assert.equal(stats.stats.engagement.ctaClicks, 1);

  const report = await request('/api/ai/report', {
    method: 'POST',
    body: { period: 'today' },
  });
  assert.equal(report.ok, true);
  assert.equal(report.report.model, 'fallback');
  assert.match(report.report.report, /AI-аналитика/);

  const reports = await request('/api/ai/reports?limit=1');
  assert.equal(reports.ok, true);
  assert.equal(reports.reports.length, 1);

  console.log('Smoke tests passed');
} finally {
  server.kill('SIGTERM');
  await rm(tempDir, { recursive: true, force: true });
}

function outputRef() {
  return output;
}

async function waitForServer(getOutput, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (getOutput().includes('API running')) return;
    if (server.exitCode !== null) throw new Error(`Server exited early:\n${getOutput()}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start:\n${getOutput()}`);
}

async function request(path, options = {}) {
  const response = await fetch(`http://localhost:${port}${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json();
  assert.equal(response.ok, true, JSON.stringify(json));
  return json;
}
