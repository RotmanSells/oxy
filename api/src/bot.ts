import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN!;
const chatId = process.env.CHAT_ID!;

if (!token || !chatId) {
  console.error('Missing BOT_TOKEN or CHAT_ID in .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

export interface LeadPayload {
  name: string;
  phone: string;
  email?: string;
  service?: string;
  message?: string;
}

export async function notifyTelegram(lead: LeadPayload) {
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

  await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export { bot };
