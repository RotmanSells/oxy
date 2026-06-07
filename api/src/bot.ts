import dotenv from 'dotenv';
import { addAdmin, getAdmins, getAiReports, getLeads, getStats, removeAdmin, type StatsPeriod } from './db.js';
import { generateAiReport } from './ai.js';
import { formatLeadList, formatLeadMessage, formatStatsMessage } from './formatters.js';

dotenv.config();

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number };
  from?: TelegramUser;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

const token = process.env.BOT_TOKEN || '';
const fallbackChatId = process.env.CHAT_ID ? Number(process.env.CHAT_ID) : null;
let updateOffset = 0;
let pollingStarted = false;

if (!token) {
  console.warn('Missing BOT_TOKEN. Telegram bot is disabled, API will still run.');
} else {
  startPolling();
}

export interface LeadPayload {
  id?: number;
  name: string;
  phone: string;
  email?: string | null;
  service?: string | null;
  message?: string | null;
  created_at?: string;
}

export async function notifyTelegram(lead: LeadPayload) {
  if (!token) return;

  const chatIds = getAdminChatIds();
  if (chatIds.length === 0) {
    console.warn('No admins registered. Send /start to bot or set CHAT_ID.');
    return;
  }

  const text = formatLeadMessage(lead);

  for (const chatId of chatIds) {
    try {
      await sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (err) {
      console.error(`Failed to send to ${chatId}:`, err);
    }
  }
}

function startPolling() {
  if (pollingStarted) return;
  pollingStarted = true;

  const poll = async () => {
    try {
      const updates = await telegramRequest<TelegramUpdate[]>('getUpdates', {
        offset: updateOffset,
        timeout: 25,
        allowed_updates: ['message'],
      });

      for (const update of updates) {
        updateOffset = update.update_id + 1;
        if (update.message) await handleMessage(update.message);
      }
    } catch (err) {
      console.error('Telegram polling error:', err);
      await delay(3000);
    } finally {
      setTimeout(poll, 500);
    }
  };

  void poll();
}

async function handleMessage(message: TelegramMessage) {
  const text = message.text?.trim() || '';
  if (!text.startsWith('/')) return;

  const [commandWithBot, argument] = text.split(/\s+/, 2);
  const command = commandWithBot.split('@')[0].toLowerCase();
  const chatId = message.chat.id;

  if (command === '/start') {
    const username = message.from?.username || '';
    const firstName = message.from?.first_name || '';
    addAdmin(chatId, username, firstName);
    await sendMessage(chatId, buildHelpMessage(firstName), { parse_mode: 'HTML', disable_web_page_preview: true });
    return;
  }

  if (!isAdminChat(chatId)) {
    await denyAccess(chatId);
    return;
  }

  if (command === '/stop') {
    removeAdmin(chatId);
    await sendMessage(chatId, '❌ Вы отписались от уведомлений.');
    return;
  }

  if (command === '/help') {
    await sendMessage(chatId, buildHelpMessage(message.from?.first_name || ''), { parse_mode: 'HTML', disable_web_page_preview: true });
    return;
  }

  if (command === '/leads') {
    const limit = Math.min(Number(argument) || 10, 30);
    await sendMessage(chatId, formatLeadList(getLeads(limit, 0)), { parse_mode: 'HTML' });
    return;
  }

  if (command === '/stats') {
    const period = parsePeriod(argument, 'today');
    await sendMessage(chatId, formatStatsMessage(getStats(period)), { parse_mode: 'HTML' });
    return;
  }

  if (command === '/ai') {
    const period = parsePeriod(argument, 'week');
    await sendMessage(chatId, '🤖 Готовлю AI-анализ сайта...');

    try {
      const result = await generateAiReport(period);
      await sendMessage(chatId, result.report, { disable_web_page_preview: true });
    } catch (err) {
      console.error('AI command error:', err);
      await sendMessage(chatId, 'Не удалось сделать AI-анализ. Проверьте OPENAI_API_KEY или попробуйте позже.');
    }
    return;
  }

  if (command === '/reports') {
    const reports = getAiReports(5);
    const response = reports.length
      ? reports.map(report => `#${report.id} ${report.created_at} (${report.period})\n${report.report_text.slice(0, 700)}`).join('\n\n')
      : 'AI-отчётов пока нет. Запустите /ai';
    await sendMessage(chatId, response, { disable_web_page_preview: true });
    return;
  }

  await sendMessage(chatId, 'Неизвестная команда. Напишите /help');
}

async function sendMessage(chatId: number, text: string, options: Record<string, unknown> = {}) {
  if (!token) return;
  await telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    ...options,
  });
}

async function telegramRequest<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json() as { ok: boolean; result: T; description?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API error ${response.status}`);
  }

  return data.result;
}

function getAdminChatIds() {
  const chatIds = getAdmins().map((admin) => admin.chat_id);
  if (chatIds.length === 0 && fallbackChatId) chatIds.push(fallbackChatId);
  return Array.from(new Set(chatIds));
}

function isAdminChat(chatId: number) {
  return getAdminChatIds().includes(chatId);
}

async function denyAccess(chatId: number) {
  await sendMessage(chatId, '⛔️ Нет доступа. Напишите /start с основного аккаунта администратора.');
}

function parsePeriod(value: string | undefined, fallback: StatsPeriod): StatsPeriod {
  return value === 'today' || value === 'week' || value === 'month' ? value : fallback;
}

function buildHelpMessage(firstName: string) {
  const hello = firstName ? `👋 Привет, ${firstName}!` : '👋 Привет!';
  return [
    hello,
    '',
    '✅ Вы подключены к сайту INTEGRA KOTOVA.',
    '',
    '<b>Команды:</b>',
    '/leads — последние 10 заявок',
    '/leads 20 — последние 20 заявок',
    '/stats — статистика за сегодня',
    '/stats week — статистика за неделю',
    '/stats month — статистика за месяц',
    '/ai — AI-анализ за неделю',
    '/ai month — AI-анализ за месяц',
    '/reports — последние AI-отчёты',
    '/help — помощь',
    '/stop — отключить уведомления',
  ].join('\n');
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
