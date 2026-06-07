import { createAiReport, getAiReports, getStats, type StatsPeriod } from './db.js';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const SHORT_REPLY_STYLE = [
  'Стиль ответа: коротко, по делу, без воды.',
  'Не используй Markdown: никаких **, __, ###, таблиц и длинных списков.',
  'Пиши обычным текстом для Telegram.',
  'Максимум 5 коротких строк.',
  'Если нужны действия — дай 2-3 конкретных пункта.',
  'Не повторяй вопрос и не добавляй вступления.',
].join(' ');

export interface AiReportResult {
  period: StatsPeriod;
  model: string;
  report: string;
  stats: ReturnType<typeof getStats>;
  saved: boolean;
}

export async function generateAiReport(period: StatsPeriod = 'week'): Promise<AiReportResult> {
  const stats = getStats(period);
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const model = process.env.OPENAI_MODEL || process.env.AI_MODEL || DEFAULT_MODEL;
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || DEFAULT_BASE_URL);

  if (!apiKey) {
    const report = humanizeAiText(buildFallbackReport(stats));
    createAiReport(period, stats, report, 'fallback');
    return { period, model: 'fallback', report, stats, saved: true };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `Ты веб-аналитик сайта премиального девелопмента INTEGRA KOTOVA. Отвечай по-русски, только по данным. Не выдумывай факты. ${SHORT_REPLY_STYLE}`,
        },
        {
          role: 'user',
          content: `Проанализируй агрегированную статистику сайта за период ${period}. Персональных данных нет. Данные: ${JSON.stringify(stats)}`,
        },
      ],
      max_tokens: 280,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const data = await response.json() as ChatCompletionResponse;
  const report = humanizeAiText(extractOutputText(data) || buildFallbackReport(stats));
  createAiReport(period, stats, report, model);

  return { period, model, report, stats, saved: true };
}


export async function askAiQuestion(question: string): Promise<string> {
  const stats = getStats('week');
  const reports = getAiReports(3).map(report => report.report_text).join('\n\n');
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const model = process.env.OPENAI_MODEL || process.env.AI_MODEL || DEFAULT_MODEL;
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || DEFAULT_BASE_URL);

  if (!apiKey) {
    return humanizeAiText([
      'AI-ключ не подключён.',
      `За 7 дней: визиты — ${stats.traffic.visits}, заявки — ${stats.leads.period}, конверсия — ${stats.engagement.conversionRate}%.`,
      'Для полноценного ответа подключите AI-ключ на сервере.',
    ].join('\n'));
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `Ты помощник администратора сайта INTEGRA KOTOVA в Telegram. Отвечай понятно, по-русски, без технических ключей вроде hero/projects/services. Если вопрос про сайт, используй статистику. Если обычный разговор — отвечай дружелюбно. ${SHORT_REPLY_STYLE}`,
        },
        {
          role: 'user',
          content: `Статистика сайта за 7 дней: ${JSON.stringify(stats)}\n\nПоследние AI-отчёты: ${reports || 'пока нет'}\n\nВопрос администратора: ${question}`,
        },
      ],
      max_tokens: 220,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const data = await response.json() as ChatCompletionResponse;
  return humanizeAiText(extractOutputText(data) || 'Не смог подготовить ответ. Попробуйте задать вопрос иначе.');
}


interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
}

function extractOutputText(data: ChatCompletionResponse) {
  const firstChoice = data.choices?.[0];
  return (firstChoice?.message?.content || firstChoice?.text || '').trim();
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function formatStatsPeriod(period: StatsPeriod) {
  if (period === 'today') return 'сегодня';
  if (period === 'week') return '7 дней';
  if (period === 'month') return '30 дней';
  return period;
}

function buildFallbackReport(stats: ReturnType<typeof getStats>) {
  const lines = [
    `За ${formatStatsPeriod(stats.period)}: визиты — ${stats.traffic.visits}, заявки — ${stats.leads.period}, конверсия — ${stats.engagement.conversionRate}%.`,
  ];

  if (stats.traffic.visits === 0) {
    lines.push('Нужно накопить статистику минимум за несколько дней.');
  } else if (stats.leads.period === 0) {
    lines.push('Заявок нет: проверьте форму, кнопки Telegram/WhatsApp и первый экран.');
  } else {
    lines.push('Заявки есть: усиливайте самые кликабельные направления.');
  }

  if (stats.engagement.averageScrollDepth && stats.engagement.averageScrollDepth < 50) {
    lines.push('Скролл низкий: усилить первый экран и быстрее показать выгоды.');
  }

  if (stats.topSections.length) {
    lines.push(`Самый активный блок: ${stats.topSections[0].section}.`);
  }

  return lines.join('\n');
}


function humanizeAiText(text: string) {
  return cleanAiText(text)
    .replace(/\bhero\b/gi, 'Главный экран')
    .replace(/\babout\b/gi, 'О компании')
    .replace(/\bprojects\b/gi, 'Проекты')
    .replace(/\bagclub\b/gi, 'AG Club Villas')
    .replace(/\bservices\b/gi, 'Услуги')
    .replace(/\badvantages\b/gi, 'Преимущества')
    .replace(/\bcontacts?\b/gi, 'Контакты')
    .replace(/\bsection\b/gi, 'блок сайта')
    .replace(/\bsections\b/gi, 'блоки сайта');
}

function cleanAiText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
