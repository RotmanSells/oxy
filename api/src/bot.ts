import dotenv from 'dotenv';
import {
  addAdmin,
  getAdmins,
  getAiReports,
  getContent,
  getLeads,
  getStats,
  removeAdmin,
  setContent,
  setMedia,
  type StatsPeriod,
} from './db.js';
import { contentKeys, findContentKey, findMediaKey, mediaKeys } from './contentKeys.js';
import { askAiQuestion, generateAiReport } from './ai.js';
import { formatLeadList, formatLeadMessage, formatStatsMessage, humanizeSiteTerms } from './formatters.js';
import { saveImageUpload } from './uploads.js';

dotenv.config();

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  chat: { id: number };
  from?: TelegramUser;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

type PendingAction =
  | { action: 'edit_text'; key: string }
  | { action: 'upload_photo'; key: string }
  | { action: 'ai_chat' };

const token = process.env.BOT_TOKEN || '';
const fallbackChatId = process.env.CHAT_ID ? Number(process.env.CHAT_ID) : null;
const configuredAdminIds = Array.from(new Set([
  fallbackChatId,
  807511268,
  ...(process.env.ADMIN_CHAT_IDS || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value)),
].filter((value): value is number => Boolean(value))));
const pendingActions = new Map<number, PendingAction>();
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
    console.warn('No admins registered. Set CHAT_ID and send /start to bot.');
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
        allowed_updates: ['message', 'callback_query'],
      });

      for (const update of updates) {
        updateOffset = update.update_id + 1;
        if (update.callback_query) await handleCallbackQuery(update.callback_query);
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
  const chatId = message.chat.id;

  if (text.startsWith('/start')) {
    await handleStart(message);
    return;
  }

  if (!isAdminChat(chatId)) {
    await denyAccess(chatId);
    return;
  }

  if (text === '📝 Тексты') {
    pendingActions.delete(chatId);
    await showContentKeys(chatId);
    return;
  }

  if (text === '🖼 Фото') {
    pendingActions.delete(chatId);
    await showMediaKeys(chatId);
    return;
  }

  if (text === '📊 Статистика') {
    pendingActions.delete(chatId);
    await sendMessage(chatId, formatStatsMessage(getStats('today')), { parse_mode: 'HTML', ...mainMenuKeyboard() });
    return;
  }

  if (text === '🤖 AI') {
    await runAiReport(chatId, 'week', true);
    return;
  }

  const pending = pendingActions.get(chatId);
  if (pending && !text.startsWith('/')) {
    await handlePendingMessage(message, pending);
    return;
  }

  if (!text.startsWith('/')) {
    await sendMessage(chatId, 'Выберите действие в меню или напишите /help.', mainMenuKeyboard());
    return;
  }

  const { command, argument } = parseCommand(text);

  if (command === '/stop') {
    removeAdmin(chatId);
    pendingActions.delete(chatId);
    await sendMessage(chatId, '❌ Вы отписались от уведомлений.', { reply_markup: { remove_keyboard: true } });
    return;
  }

  if (command === '/help') {
    pendingActions.delete(chatId);
    await sendMessage(chatId, buildHelpMessage(message.from?.first_name || ''), { parse_mode: 'HTML', disable_web_page_preview: true, ...mainMenuKeyboard() });
    return;
  }

  if (command === '/leads') {
    const limit = Math.min(Number(argument) || 10, 30);
    await sendMessage(chatId, formatLeadList(getLeads(limit, 0)), { parse_mode: 'HTML', ...mainMenuKeyboard() });
    return;
  }

  if (command === '/stats') {
    const period = parsePeriod(argument, 'today');
    await sendMessage(chatId, formatStatsMessage(getStats(period)), { parse_mode: 'HTML', ...mainMenuKeyboard() });
    return;
  }

  if (command === '/ai') {
    const period = parsePeriod(argument, 'week');
    pendingActions.delete(chatId);
    await runAiReport(chatId, period, true);
    return;
  }

  if (command === '/reports') {
    const reports = getAiReports(5);
    const response = reports.length
      ? reports.map(report => `Отчёт от ${report.created_at} (${formatPeriodLabel(report.period)})\n${humanizeSiteTerms(report.report_text).slice(0, 700)}`).join('\n\n')
      : 'AI-отчётов пока нет. Запустите /ai';
    await sendMessage(chatId, response, { disable_web_page_preview: true, ...mainMenuKeyboard() });
    return;
  }

  if (command === '/set' || command === '/content') {
    await handleSetCommand(chatId, argument);
    return;
  }

  if (command === '/get') {
    await handleGetCommand(chatId, argument);
    return;
  }

  if (command === '/photo') {
    await handlePhotoCommand(chatId, argument);
    return;
  }

  await sendMessage(chatId, 'Неизвестная команда. Напишите /help', mainMenuKeyboard());
}

async function handleStart(message: TelegramMessage) {
  const chatId = message.chat.id;

  if (!configuredAdminIds.includes(chatId)) {
    await denyAccess(chatId);
    return;
  }

  const username = message.from?.username || '';
  const firstName = message.from?.first_name || '';
  addAdmin(chatId, username, firstName);
  await sendMessage(chatId, buildHelpMessage(firstName), { parse_mode: 'HTML', disable_web_page_preview: true, ...mainMenuKeyboard() });
}

async function handleCallbackQuery(query: TelegramCallbackQuery) {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  await answerCallbackQuery(query.id);

  if (!isAdminChat(chatId)) {
    await denyAccess(chatId);
    return;
  }

  const data = query.data || '';

  if (data === 'menu:texts') {
    pendingActions.delete(chatId);
    await showContentKeys(chatId);
    return;
  }

  if (data === 'menu:photos') {
    pendingActions.delete(chatId);
    await showMediaKeys(chatId);
    return;
  }

  if (data === 'menu:stats') {
    pendingActions.delete(chatId);
    await sendMessage(chatId, formatStatsMessage(getStats('today')), { parse_mode: 'HTML', ...mainMenuKeyboard() });
    return;
  }

  if (data === 'menu:ai') {
    await runAiReport(chatId, 'week', true);
    return;
  }

  if (data.startsWith('content:')) {
    await promptTextEdit(chatId, data.slice('content:'.length));
    return;
  }

  if (data.startsWith('media:')) {
    await promptPhotoUpload(chatId, data.slice('media:'.length));
  }
}

async function handlePendingMessage(message: TelegramMessage, pending: PendingAction) {
  if (pending.action === 'ai_chat') {
    await handleAiQuestion(message);
    return;
  }

  if (pending.action === 'edit_text') {
    const value = message.text?.trim();
    if (!value) {
      await sendMessage(message.chat.id, 'Отправьте новый текст сообщением. Чтобы выйти — нажмите любой пункт меню.', mainMenuKeyboard());
      return;
    }

    const definition = findContentKey(pending.key);
    setContent(pending.key, {
      value,
      type: definition?.type || 'text',
      section: definition?.section,
      label: definition?.label,
    });
    pendingActions.delete(message.chat.id);
    await sendMessage(message.chat.id, '✅ Текст обновлён', mainMenuKeyboard());
    return;
  }

  await saveTelegramPhoto(message, pending.key);
}

async function handleSetCommand(chatId: number, argument?: string) {
  const parsed = parseKeyValue(argument);
  if (!parsed) {
    await sendMessage(chatId, 'Проще обновлять текст через кнопку 📝 Тексты. Выберите нужный пункт и отправьте новый текст.', mainMenuKeyboard());
    return;
  }

  const definition = findContentKey(parsed.key);
  setContent(parsed.key, {
    value: parsed.value,
    type: definition?.type || 'text',
    section: definition?.section,
    label: definition?.label,
  });
  pendingActions.delete(chatId);
  await sendMessage(chatId, '✅ Текст обновлён', mainMenuKeyboard());
}

async function handleGetCommand(chatId: number, argument?: string) {
  const key = normalizeKey(argument || '');
  if (!key) {
    await sendMessage(chatId, 'Проще посмотреть текст через кнопку 📝 Тексты. Выберите нужный пункт из списка.', mainMenuKeyboard());
    return;
  }

  const content = getContent(key);
  if (!content) {
    await sendMessage(chatId, 'Текст не найден. Нажмите 📝 Тексты, чтобы увидеть список.', mainMenuKeyboard());
    return;
  }

  await sendMessage(chatId, formatContentPreview(content.key, content.label, content.value), { parse_mode: 'HTML', ...mainMenuKeyboard() });
}

async function handlePhotoCommand(chatId: number, argument?: string) {
  const key = normalizeKey(argument || '');
  if (!findMediaKey(key)) {
    await sendMessage(chatId, 'Нажмите 🖼 Фото и выберите, какое фото заменить.', mainMenuKeyboard());
    return;
  }

  await promptPhotoUpload(chatId, key);
}

async function promptTextEdit(chatId: number, key: string) {
  const definition = findContentKey(key);
  if (!definition) {
    await sendMessage(chatId, 'Текст не найден. Нажмите 📝 Тексты, чтобы увидеть список.', mainMenuKeyboard());
    return;
  }

  const current = getContent(key);
  pendingActions.set(chatId, { action: 'edit_text', key });
  await sendMessage(
    chatId,
    `${formatContentPreview(key, definition.label, current?.value || '')}\n\nОтправьте новый текст следующим сообщением.`,
    { parse_mode: 'HTML', ...mainMenuKeyboard() }
  );
}

async function promptPhotoUpload(chatId: number, key: string) {
  const definition = findMediaKey(key);
  if (!definition) {
    await sendMessage(chatId, 'Фото не найдено. Нажмите 🖼 Фото, чтобы увидеть список.', mainMenuKeyboard());
    return;
  }

  pendingActions.set(chatId, { action: 'upload_photo', key });
  await sendMessage(chatId, `🖼 ${escapeHtml(definition.label)}\nОтправьте изображение следующим сообщением. Чтобы выйти — нажмите любой пункт меню.`, { parse_mode: 'HTML', ...mainMenuKeyboard() });
}

async function saveTelegramPhoto(message: TelegramMessage, key: string) {
  const chatId = message.chat.id;
  const photo = message.photo?.slice().sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
  const document = message.document?.mime_type?.startsWith('image/') ? message.document : undefined;
  const fileId = document?.file_id || photo?.file_id;

  if (!fileId) {
    await sendMessage(chatId, 'Пожалуйста, отправьте фото JPG, PNG или WebP. Чтобы выйти — нажмите любой пункт меню.', mainMenuKeyboard());
    return;
  }

  try {
    const file = await telegramRequest<TelegramFile>('getFile', { file_id: fileId });
    if (!file.file_path) throw new Error('Telegram did not return file_path');

    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    if (!response.ok) throw new Error(`Telegram file download failed: ${response.status}`);

    const saved = await saveImageUpload({
      key,
      bytes: new Uint8Array(await response.arrayBuffer()),
      mimeType: document?.mime_type || mimeTypeFromTelegramPath(file.file_path),
      originalName: document?.file_name || file.file_path.split('/').pop(),
    });
    const definition = findMediaKey(key);
    setMedia(key, {
      filePath: saved.filePath,
      publicUrl: saved.publicUrl,
      originalName: saved.originalName,
      mimeType: saved.mimeType,
      section: definition?.section,
      label: definition?.label,
    });
    pendingActions.delete(chatId);
    await sendMessage(chatId, `✅ Фото обновлено\n${saved.publicUrl}`, mainMenuKeyboard());
  } catch (err) {
    console.error('Telegram photo save error:', err);
    await sendMessage(chatId, 'Не удалось сохранить фото. Проверьте формат JPG/PNG/WebP и размер до 8 MB.', mainMenuKeyboard());
  }
}

async function showContentKeys(chatId: number) {
  await sendMessage(chatId, '📝 Выберите текст для редактирования:', {
    reply_markup: {
      inline_keyboard: contentKeys.map((item) => [{ text: item.label, callback_data: `content:${item.key}` }]),
    },
  });
}

async function showMediaKeys(chatId: number) {
  await sendMessage(chatId, '🖼 Выберите фото для замены:', {
    reply_markup: {
      inline_keyboard: mediaKeys.map((item) => [{ text: item.label, callback_data: `media:${item.key}` }]),
    },
  });
}

async function runAiReport(chatId: number, period: StatsPeriod, keepChatOpen = false) {
  await sendMessage(chatId, '🤖 Готовлю AI-анализ сайта...', mainMenuKeyboard());

  try {
    const result = await generateAiReport(period);
    if (keepChatOpen) pendingActions.set(chatId, { action: 'ai_chat' });
    const suffix = keepChatOpen ? '\n\nНапишите следующий вопрос или выберите пункт меню.' : '';
    await sendMessage(chatId, `${humanizeSiteTerms(result.report)}${suffix}`, { disable_web_page_preview: true, ...mainMenuKeyboard() });
  } catch (err) {
    console.error('AI command error:', err);
    await sendMessage(chatId, 'Не удалось сделать AI-анализ. Попробуйте позже.', mainMenuKeyboard());
  }
}

async function handleAiQuestion(message: TelegramMessage) {
  const chatId = message.chat.id;
  const question = message.text?.trim();
  if (!question) {
    await sendMessage(chatId, 'Напишите вопрос текстом. Чтобы выйти — нажмите любой пункт меню.', mainMenuKeyboard());
    return;
  }

  await sendMessage(chatId, '🤖 Думаю...', mainMenuKeyboard());
  try {
    const answer = await askAiQuestion(question);
    pendingActions.set(chatId, { action: 'ai_chat' });
    await sendMessage(chatId, `${humanizeSiteTerms(answer)}\n\nСледующий вопрос или пункт меню.`, { disable_web_page_preview: true, ...mainMenuKeyboard() });
  } catch (err) {
    console.error('AI chat error:', err);
    await sendMessage(chatId, 'Не удалось ответить. Попробуйте ещё раз или нажмите другой пункт меню.', mainMenuKeyboard());
  }
}

async function sendMessage(chatId: number, text: string, options: Record<string, unknown> = {}) {
  if (!token) return;
  await telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    ...options,
  });
}

async function answerCallbackQuery(callbackQueryId: string) {
  if (!token) return;
  await telegramRequest('answerCallbackQuery', { callback_query_id: callbackQueryId });
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
  chatIds.push(...configuredAdminIds);
  return Array.from(new Set(chatIds));
}

function isAdminChat(chatId: number) {
  return getAdminChatIds().includes(chatId);
}

async function denyAccess(chatId: number) {
  await sendMessage(chatId, '⛔️ Нет доступа. Этот бот доступен только администраторам сайта.');
}

function parseCommand(text: string) {
  const match = text.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  const command = (match?.[1] || '').split('@')[0].toLowerCase();
  const argument = match?.[2]?.trim() || '';
  return { command, argument };
}

function parseKeyValue(argument?: string) {
  const match = argument?.match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) return null;
  const key = normalizeKey(match[1]);
  const value = match[2].trim();
  return key && value ? { key, value } : null;
}

function normalizeKey(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function parsePeriod(value: string | undefined, fallback: StatsPeriod): StatsPeriod {
  return value === 'today' || value === 'week' || value === 'month' ? value : fallback;
}

function formatPeriodLabel(value: string) {
  if (value === 'today') return 'сегодня';
  if (value === 'week') return '7 дней';
  if (value === 'month') return '30 дней';
  return value;
}

function buildHelpMessage(firstName: string) {
  const hello = firstName ? `👋 Привет, ${firstName}!` : '👋 Привет!';
  return [
    hello,
    '',
    '✅ Вы подключены к сайту INTEGRA KOTOVA.',
    '',
    '<b>Меню:</b>',
    '📊 Статистика — статистика за сегодня',
    '📝 Тексты — редактировать тексты сайта',
    '🖼 Фото — заменить фото сайта',
    '🤖 AI — анализ сайта и свободный диалог',
    '',
    '<b>Команды:</b>',
    '/leads — последние 10 заявок',
    '/leads 20 — последние 20 заявок',
    '/stats — статистика за сегодня',
    '/stats week — статистика за неделю',
    '/stats month — статистика за месяц',
    '/ai — AI-анализ и диалог',
    '/ai month — AI-анализ за месяц',
    '/reports — последние AI-отчёты',
    '/help — помощь',
    '/stop — отключить уведомления',
  ].join('\n');
}

function mainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '📊 Статистика' }, { text: '📝 Тексты' }],
        [{ text: '🖼 Фото' }, { text: '🤖 AI' }],
      ],
      resize_keyboard: true,
    },
  };
}

function formatContentPreview(key: string, label: string | null | undefined, value: string) {
  const definition = findContentKey(key);
  const title = label || definition?.label || 'Текст сайта';
  const preview = value || 'Пока пусто';
  return `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(preview).slice(0, 3500)}`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mimeTypeFromTelegramPath(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
