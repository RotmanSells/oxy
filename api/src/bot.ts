import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { addAdmin, getAdmins, removeAdmin } from './db.js';

dotenv.config();

const token = process.env.BOT_TOKEN!;
const fallbackChatId = process.env.CHAT_ID ? Number(process.env.CHAT_ID) : null;

if (!token) {
  console.error('Missing BOT_TOKEN in .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Обработка /start — админ подписывается на заявки
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from?.username || '';
  const firstName = msg.from?.first_name || '';

  addAdmin(chatId, username, firstName);

  bot.sendMessage(chatId, `👋 Привет, ${firstName || 'админ'}!\n\n✅ Вы подписаны на уведомления о заявках с сайта INTEGRA KOTOVA.\n\nКогда кто-то заполнит форму, вы получите сообщение прямо сюда.`, {
    parse_mode: 'HTML',
  });
});

// Обработка /stop — отписаться
bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  removeAdmin(chatId);
  bot.sendMessage(chatId, '❌ Вы отписались от уведомлений.');
});

export interface LeadPayload {
  name: string;
  phone: string;
  email?: string;
  service?: string;
  message?: string;
}

export async function notifyTelegram(lead: LeadPayload) {
  const admins = getAdmins();
  const chatIds = admins.map(a => a.chat_id);

  // Если нет админов в БД, используем fallback CHAT_ID
  if (chatIds.length === 0 && fallbackChatId) {
    chatIds.push(fallbackChatId);
  }

  if (chatIds.length === 0) {
    console.warn('No admins registered. Send /start to bot to subscribe.');
    return;
  }

  const lines = [
    '🔔 <b>Новая заявка с сайта</b>',
    '',
    `👤 <b>Имя:</b> ${escapeHtml(lead.name)}`,
    `📞 <b>Телефон:</b> ${escapeHtml(lead.phone)}`,
  ];

  if (lead.email) lines.push(`✉️ <b>Email:</b> ${escapeHtml(lead.email)}`);
  if (lead.service) lines.push(`🏗 <b>Направление:</b> ${escapeHtml(lead.service)}`);
  if (lead.message) lines.push(`💬 <b>Сообщение:</b> ${escapeHtml(lead.message)}`);

  const text = lines.join('\n');

  for (const chatId of chatIds) {
    try {
      await bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    } catch (err) {
      console.error(`Failed to send to ${chatId}:`, err);
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export { bot };
